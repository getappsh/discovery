import { Injectable, BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { RuleService } from '@app/common/rules/services';
import { RuleEvaluationService } from '@app/common/rules/services/rule-evaluation.service';
import { CreateRestrictionDto, UpdateRuleDto, RestrictionQueryDto, EvaluateRuleDto, EvaluateRuleResultDto, EvaluatedDeviceDto, AttachedReleaseDto } from '@app/common/rules/dto';
import { RuleType } from '@app/common/rules/enums/rule.enums';
import { DeviceEntity } from '@app/common/database/entities/device.entity';
import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { UploadTopics } from '@app/common/microservice-client/topics';

@Injectable()
export class RestrictionsService {
  constructor(
    private readonly ruleService: RuleService,
    private readonly ruleEvaluationService: RuleEvaluationService,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepository: Repository<DeviceEntity>,
    @InjectRepository(DiscoveryMessageEntity)
    private readonly discoveryMessageRepository: Repository<DiscoveryMessageEntity>,
    @Inject(MicroserviceName.UPLOAD_SERVICE)
    private readonly uploadClient: MicroserviceClient,
  ) {}

  /**
   * Creates a new restriction (device/os-associated rule)
   */
  async createRestriction(createRestrictionDto: CreateRestrictionDto) {
    // Convert to internal CreateRuleDto format
    const createRuleDto = {
      ...createRestrictionDto,
      type: RuleType.RESTRICTION,
    };
    
    const rule = await this.ruleService.createRule(createRuleDto);
    return this.ruleService.ruleEntityToDefinition(rule);
  }

  /**
   * Updates an existing restriction
   */
  async updateRestriction(id: string, updateRuleDto: UpdateRuleDto) {
    const rule = await this.ruleService.updateRule(id, updateRuleDto);
    return this.ruleService.ruleEntityToDefinition(rule);
  }

  /**
   * Deletes a restriction
   */
  async deleteRestriction(id: string) {
    await this.ruleService.deleteRule(id);
    return { success: true, message: 'Restriction deleted successfully' };
  }

  /**
   * Gets a specific restriction by ID
   */
  async getRestriction(id: string) {
    const rule = await this.ruleService.findOneById(id);
    return this.ruleService.ruleEntityToDefinition(rule);
  }

  /**
   * Lists all restrictions with optional filters
   */
  async listRestrictions(query: RestrictionQueryDto) {
    const rules = await this.ruleService.findAll({ ...query, type: RuleType.RESTRICTION });
    return rules.map(rule => this.ruleService.ruleEntityToDefinition(rule));
  }

  /**
   * Evaluates a restriction rule against all devices.
   *
   * Accepts either an existing ruleId (loads it from the DB) or an inline rule
   * JSON.  For each device it builds a context from the latest discovery message
   * and evaluates the rule against that context.  Returns the list of matching
   * devices alongside summary counts.
   */
  /**
   * Evaluates a rule against all devices.
   *
   * Accepts either an existing ruleId (loads it from the DB) or an inline rule
   * JSON.  When a saved ruleId is provided:
   *   - RESTRICTION rules are resolved locally from discovery's DB.
   *   - POLICY rules are resolved via the upload microservice, which also
   *     returns the releases the policy is attached to; those are included in
   *     the result so callers know the policy context.
   *
   * Returns the subset of devices whose latest discovery data satisfies the rule.
   */
  async evaluateRule(dto: EvaluateRuleDto): Promise<EvaluateRuleResultDto> {
    if (!dto.ruleId && !dto.rule) {
      throw new BadRequestException('Either ruleId or rule must be provided');
    }

    let ruleJson: any;
    let attachedReleases: AttachedReleaseDto[] | undefined;

    if (dto.ruleId) {
      // Try to load the rule locally first (restrictions live here).
      // If not found — e.g. when discovery and upload use separate databases —
      // fall back to asking the upload microservice (which owns policies).
      let localRule: any = null;
      try {
        localRule = await this.ruleService.findOneById(dto.ruleId);
      } catch (err) {
        if (!(err instanceof NotFoundException)) throw err;
      }

      if (localRule && localRule.type !== RuleType.POLICY) {
        // Found locally as a restriction — use it directly
        ruleJson = localRule.rule;
      } else {
        // Either a policy (upload is canonical) or not found locally (separate DB)
        const policyDefinition = await firstValueFrom(
          this.uploadClient.send(UploadTopics.GET_POLICY_INTERNAL, dto.ruleId),
        );
        ruleJson = policyDefinition.rule;
        attachedReleases = policyDefinition.association?.releases?.map(
          (r: any): AttachedReleaseDto => ({
            catalogId: r.catalogId,
            version: r.version,
            projectId: r.projectId,
            projectName: r.projectName,
          }),
        );
      }
    } else {
      ruleJson = typeof dto.rule === 'string' ? JSON.parse(dto.rule) : dto.rule;
    }

    // Get latest discovery message per device using DISTINCT ON (PostgreSQL)
    const latestMessages = await this.discoveryMessageRepository
      .createQueryBuilder('dm')
      .innerJoinAndSelect('dm.device', 'device')
      .leftJoinAndSelect('device.platform', 'platform')
      .leftJoinAndSelect('device.deviceType', 'deviceType')
      .leftJoinAndSelect('device.orgUID', 'orgUID')
      .leftJoinAndSelect('orgUID.group', 'group')
      .distinctOn(['device.ID'])
      .orderBy('device.ID', 'ASC')
      .addOrderBy('dm.snapshotDate', 'DESC')
      .getMany();

    const matchingDevices: EvaluatedDeviceDto[] = [];

    for (const message of latestMessages) {
      const context = this.buildDeviceContext(message.device, message);
      const matches = await this.ruleEvaluationService.evaluateRule(ruleJson, context);
      if (matches) {
        matchingDevices.push({
          deviceId: message.device.ID,
          deviceName: message.device.name,
          os: message.device.OS,
          ip: message.device.IP,
          mac: message.device.MAC,
          serialNumber: message.device.serialNumber,
          platformName: (message.device as any).platform?.name,
          deviceTypeNames: (message.device as any).deviceType?.map((dt: any) => dt.name) ?? [],
          groupNames: (message.device as any).orgUID?.group ? [(message.device as any).orgUID.group.name] : [],
        });
      }
    }

    return {
      matchingDevices,
      totalDevicesEvaluated: latestMessages.length,
      matchingCount: matchingDevices.length,
      ...(attachedReleases !== undefined && { attachedReleases }),
    };
  }

  /**
   * Builds a flat evaluation context from device entity and latest discovery
   * message, exposed under a `device` key so rule fields like `device.test`
   * resolve correctly via the rule-engine's dot-path accessor.
   *
   * Priority order (each layer overwrites the previous):
   *   1. Known device entity columns (deviceId, os, ip, …)
   *   2. Top-level keys of every discovery JSONB blob
   *   3. Keys from the nested `metadata` sub-object inside each blob  ← dynamic
   *
   * The entire merged object is available both under `context.device.*`
   * (for field names like `device.os`) and flat at `context.*` for backward
   * compatibility with rules that skip the prefix.
   */
  private buildDeviceContext(
    device: DeviceEntity,
    message: DiscoveryMessageEntity,
  ): Record<string, any> {
    // Merge all blobs in ascending specificity order into a single raw object.
    // The nested `metadata` sub-object inside each blob is promoted to the top
    // level so dynamic fields like `device.test` become directly accessible.
    const raw: Record<string, any> = {};
    for (const blob of [
      message.metaData,
      message.personalDevice,
      message.situationalDevice,
      message.discoveryData,
    ].filter(Boolean) as Record<string, any>[]) {
      Object.assign(raw, blob);
      if (blob.metadata && typeof blob.metadata === 'object' && !Array.isArray(blob.metadata)) {
        Object.assign(raw, blob.metadata);
      }
    }

    // Destructure out non-canonical / aliased keys so they are never present in
    // the final object — everything else (...rest) is kept as dynamic blob data.
    const {
      metadata: _metadata,   // already promoted above, drop the nested copy
      deviceName,            // alias → name
      mac,                   // alias → macAddress
      availableStorage,      // alias → storage.available
      power,                 // alias → battery.level
      os: rawOs,             // may be a plain string — normalised below
      ...rest
    } = raw;

    const osValue = rawOs ?? device.OS;

    const deviceFields: Record<string, any> = {
      // Dynamic blob data (non-canonical keys already destructured out above)
      ...rest,
      // Canonical typed fields — entity columns are the fallback
      deviceId: device.ID,
      name: rest.name ?? deviceName ?? device.name,
      os: typeof osValue === 'string' ? { name: osValue } : (osValue ?? {}),
      ip: rest.ip ?? device.IP,
      macAddress: rest.macAddress ?? mac ?? device.MAC,
      serialNumber: rest.serialNumber ?? device.serialNumber,
      // Canonical aliases for blob-sourced fields
      ...(availableStorage !== undefined && {
        storage: { ...(typeof rest.storage === 'object' ? rest.storage : {}), available: availableStorage },
      }),
      ...(power !== undefined && {
        battery: { ...(typeof rest.battery === 'object' ? rest.battery : {}), level: power },
      }),
      // Sentinel: `device.any` is always true — use as "match all" in rules
      any: true,
    };

    return {
      // Nested namespace: rules can reference field "device.test"
      device: deviceFields,
      // Flat spread: rules can reference field "test" directly (backward compat)
      ...deviceFields,
    };
  }
}
