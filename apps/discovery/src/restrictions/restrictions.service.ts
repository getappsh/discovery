import { Injectable, BadRequestException, Inject } from '@nestjs/common';
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
    // Force type to be restriction
    query.type = RuleType.RESTRICTION;
    
    const rules = await this.ruleService.findAll(query);
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
      // Load via upload if it is a policy (upload owns policies), otherwise
      // load locally for restrictions.
      const localRule = await this.ruleService.findOneById(dto.ruleId);
      if (localRule.type === RuleType.POLICY) {
        // Ask upload for the canonical rule + its release associations
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
      } else {
        ruleJson = localRule.rule;
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
    // Collect all blobs in ascending specificity order
    const blobs = [
      message.metaData,
      message.personalDevice,
      message.situationalDevice,
      message.discoveryData,
    ].filter(Boolean) as Record<string, any>[];

    // Start with known, typed device columns
    const deviceFields: Record<string, any> = {
      deviceId: device.ID,
      deviceName: device.name,
      os: device.OS,
      ip: device.IP,
      mac: device.MAC,
      serialNumber: device.serialNumber,
    };

    for (const blob of blobs) {
      // Spread top-level blob keys (e.g. deliverySource, deviceType …)
      Object.assign(deviceFields, blob);
      // Also promote the nested `metadata` object so dynamic fields like
      // `device.test` or `device.additionalProp1` become directly accessible
      if (blob.metadata && typeof blob.metadata === 'object' && !Array.isArray(blob.metadata)) {
        Object.assign(deviceFields, blob.metadata);
      }
    }

    // Remove the now-redundant nested `metadata` key to avoid ambiguity
    delete deviceFields.metadata;

    // Sentinel field: `device.any` (and bare `any`) is always true.
    // Rules can use it as a "match all devices" condition regardless of device state.
    deviceFields.any = true;

    return {
      // Nested namespace: rules can reference field "device.test"
      device: deviceFields,
      // Flat spread: rules can reference field "test" directly (backward compat)
      ...deviceFields,
    };
  }
}
