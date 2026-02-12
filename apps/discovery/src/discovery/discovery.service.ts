import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Not, Repository } from 'typeorm';
import { DeviceComponentEntity, DeviceComponentStateEnum, DeviceEntity, DeviceTypeEntity, DiscoveryType, PlatformEntity } from '@app/common/database/entities';
import { ComponentStateDto, DiscoveryMessageDto, DiscoveryMessageV2Dto } from '@app/common/dto/discovery';
import { MTlsStatusDto } from '@app/common/dto/device';
import { DeviceDiscoverDto, DeviceDiscoverResDto } from '@app/common/dto/im';
import { DeviceService } from '../device/device.service';
import { DeviceComponentStateDto } from '@app/common/dto/device/dto/device-software.dto';
import { ComponentV2Dto } from '@app/common/dto/upload';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DeviceRepoService } from '../modules/device-client-repo/device-repo.service';
import { DevicePutDto } from '@app/common/dto/device/dto/device-put.dto';
import { PendingVersionService } from '../pending-version/pending-version.service';
import { AppError, ErrorCode } from '@app/common/dto/error';
import { RuleService } from '@app/common/rules/services';
import { RuleType } from '@app/common/rules/enums/rule.enums';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { ProjectManagementTopics, UploadTopics, UploadTopicsEmit } from '@app/common/microservice-client/topics';
import { lastValueFrom } from 'rxjs';
import { ReleaseDto } from '@app/common/dto/upload';

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @InjectRepository(DiscoveryMessageEntity) private readonly discoveryMessageRepo: Repository<DiscoveryMessageEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(DeviceComponentEntity) private readonly deviceComponentRepo: Repository<DeviceComponentEntity>,
    @InjectRepository(PlatformEntity) private readonly platformRepo: Repository<PlatformEntity>,
    @InjectRepository(DeviceTypeEntity) private readonly deviceTypeRepo: Repository<DeviceTypeEntity>,
    private readonly deviceService: DeviceService,
    private readonly deviceRepoService: DeviceRepoService,
    private readonly dataSource: DataSource,
    private readonly ruleService: RuleService,
    private readonly pendingVersionService: PendingVersionService,
    @Inject(MicroserviceName.UPLOAD_SERVICE) private readonly uploadClient: MicroserviceClient,
    @Inject(MicroserviceName.PROJECT_MANAGEMENT_SERVICE) private readonly projectManagementClient: MicroserviceClient,
  ) {
  }

  async onModuleInit() {
    // Subscribe to response topics for Kafka request-response pattern
    this.uploadClient.subscribeToResponseOf([
      UploadTopics.GET_RELEASES,
    ]);
    this.projectManagementClient.subscribeToResponseOf([
      ProjectManagementTopics.GET_PROJECTS,
    ]);
    
    await Promise.all([
      this.uploadClient.connect(),
      this.projectManagementClient.connect(),
    ]);
    
    this.logger.log('DiscoveryService initialized and connected to microservices');
  }

  async getDevicePerson(deviceId: string): Promise<(Pick<DiscoveryMessageEntity, "personalDevice"> & { device: Pick<DeviceEntity, "ID">; }) | undefined | null> {
    this.logger.log(`Get device personal info`)
    try {
      const dvcPrs = await this.discoveryMessageRepo
        .createQueryBuilder('msg')
        .leftJoin('msg.device', 'device')
        .where('device.ID = :deviceId', { deviceId })
        .orderBy('msg.lastUpdatedDate', 'DESC')
        .select(['msg.personalDevice', 'device.ID'])
        .getOne();
      this.logger.debug(`Device personal res for deviceId - ${deviceId} : ${JSON.stringify(dvcPrs?.personalDevice)}`)
      return dvcPrs
    } catch (err: any) {
      this.logger.error(`Err when get personal device for deviceId ${deviceId}, Err: ${err}`)
    }

  }

  private isNum = (num) => Number.isFinite ? Number.isFinite(+num) : isFinite(+num)

  private getPlatformByToken(token: string): Promise<PlatformEntity | null> {

    if (this.isNum(token)) {
      const id = parseInt(token, 10);
      return this.platformRepo.findOne({ where: { id } });
    } else {
      return this.platformRepo.findOne({ where: { name: token } });
    }
  }

  private async getDeviceTypeByToken(token: string): Promise<DeviceTypeEntity | null> {
    let de: DeviceTypeEntity | null = null;
    if (this.isNum(token)) {
      const id = parseInt(token, 10);
      de = await this.deviceTypeRepo.findOne({ where: { id } });
    } else {
      de = await this.deviceTypeRepo.findOne({ where: { name: token } });
    }
    if (!de) this.logger.warn(`Device type not found for token: ${token}`);
    return de;
  }

  private async handleDeviceTypes(deviceTypeToken: string | undefined, device: DeviceEntity, savedDevice: DeviceEntity): Promise<void> {
    let deviceTypes: DeviceTypeEntity[] = [];
    
    if (deviceTypeToken) {
      const deviceTypesList = await Promise.all(
        deviceTypeToken.split(",").map(t => this.getDeviceTypeByToken(t.trim()))
      );
      deviceTypes = deviceTypesList.filter((dt): dt is DeviceTypeEntity => dt !== null);
    }

    // Update many-to-many relationship for deviceType after upsert
    if (deviceTypes !== undefined && deviceTypes.length >= 0) {
        const deviceTypeIds = deviceTypes.map(dt => dt.id);
        
        // Delete existing relationships that are not in the new list
        const deleteQuery = this.dataSource
          .createQueryBuilder()
          .delete()
          .from("device_device_types")
          .where("device_id = :deviceId", { deviceId: savedDevice.ID });
        
        if (deviceTypeIds.length > 0) {
          deleteQuery.andWhere("device_type_id NOT IN (:...deviceTypeIds)", { deviceTypeIds });
        }
        
        await deleteQuery.execute();
        
        // Insert new relationships (orIgnore handles duplicates)
        //add or save typeOrm function might fail due to unique constraint, so we use query builder with orIgnore
        if (deviceTypeIds.length > 0) {
          await this.dataSource
            .createQueryBuilder()
            .insert()
            .into("device_device_types")
            .values(deviceTypeIds.map(id => ({ device_id: savedDevice.ID, device_type_id: id })))
            .orIgnore()
            .execute();
        }
        
        this.logger.debug(`Device types updated: ${deviceTypes.length} type(s)`);
    }
  }

  async setDeviceContext(dto: DiscoveryMessageV2Dto, parent?: DeviceEntity): Promise<DeviceEntity> {
    let device = await this.deviceRepo.findOne({ where: { ID: dto.id } })
      ?? this.deviceRepo.create({ ...dto.general?.physicalDevice, ID: dto.id });

    // If the device's last connection date is more recent than the snapshot date,
    // it means a newer message has already been processed for this device.

    // Wrap dto.snapshotDate in Date, as microservice data loses type.
    if (parent && device.lastConnectionDate && device.lastConnectionDate > new Date(dto.snapshotDate)) return device

    device.name = dto.general?.personalDevice?.name;
    device.lastConnectionDate = parent ? dto.snapshotDate : new Date();
    device.formations = dto?.softwareData?.formations;

    device.platform = dto.platform ? (await this.getPlatformByToken(dto.platform.token)) ?? undefined : undefined;
    device.deviceType = [];
                      
    // Only device there is no of type platform, can be a device children
    if (!dto.platform) { device.parent = parent } else { device.parent = undefined }

    // Convert undefined properties to null before saving
    Object.keys(device).forEach(key => {
      if (device[key] === undefined) {
        device[key] = null;
      }
    });

    this.logger.debug("upsert device")
    let savedDevice: DeviceEntity | null = null;
    try {
      // Upsert: insert or update on conflict
      await this.deviceRepo.upsert(device, ["ID"]);
    } catch (err) {
      this.logger.error(`Device upsert failed: ${err}`);
    }
    // Retrieve the entity after upsert
    savedDevice = await this.deviceRepo.findOne({ where: { ID: device.ID } });
    if (!savedDevice) {
      throw new AppError(ErrorCode.DEVICE_NOT_FOUND, `Device with ID ${device.ID} not found after upsert.`);
    }
    
    // Handle device types and update many-to-many relationship
    await this.handleDeviceTypes(dto.deviceTypeToken, device, savedDevice);
    
    if (dto.general?.physicalDevice && 'serialNumber' in dto.general?.physicalDevice) {
      await this.putDeviceOrgIdFromDiscovery(dto, savedDevice);
    }
    return savedDevice;
  }

  private async putDeviceOrgIdFromDiscovery(dto: DiscoveryMessageV2Dto, savedDevice: DeviceEntity) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.deviceRepoService.updateDeviceOrgUID(queryRunner.manager, DevicePutDto.fromDeviceDiscovery(dto), savedDevice);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Set device org UID transaction failed - code: ${(err as AppError).errorCode}, mes: ${(err as AppError).message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async discoveryDeviceContext(dto: DiscoveryMessageV2Dto, parent?: DeviceEntity): Promise<DiscoveryMessageV2Dto> {

    this.logger.log(`Save discover mes for device ${dto.id}`);

    const device = await this.setDeviceContext(dto, parent)

    const dm = new DiscoveryMessageEntity()
    dm.snapshotDate = parent ? dto.snapshotDate : new Date()
    dm.reportingDevice = parent
    dm.discoveryType = dto.discoveryType
    dm.personalDevice = dto.general?.personalDevice;
    dm.situationalDevice = dto.general?.situationalDevice;
    dm.discoveryData = dto.softwareData;
    dm.device = device

    // Convert undefined properties to null before saving
    Object.keys(device).forEach(key => {
      if (device[key] === undefined) {
        device[key] = null;
      }
    });

    this.logger.verbose(`discovery message ${dm}`);
    this.discoveryMessageRepo.save(dm);

    const lastMsgForType = await this.discoveryMessageRepo.findOne({
      where: { device: { ID: device.ID }, discoveryType: dto.discoveryType },
      select: ["id", "snapshotDate"],
      order: { snapshotDate: "DESC" }
    })

    if (!lastMsgForType || new Date(dto.snapshotDate) > lastMsgForType.snapshotDate) {
      if (dto.discoveryType === DiscoveryType.GET_APP && dto?.softwareData?.components) {
        // Fix components where agent reports project ID as 0 but the project now exists in DB
        await this.fixZeroProjectIds(dto.softwareData.components);
        await this.setCompsOnDeviceV2(device.ID, dto?.softwareData?.components)
      }
    }

    // Send supported fields to upload microservice for syncing with database
    if (!parent && device.ID && dto.supportedFields && dto.supportedFields.length > 0) {
      try {
        this.logger.debug(`Sending ${dto.supportedFields.length} supported field(s) from device ${device.ID} to upload microservice`);
        this.uploadClient.emit(UploadTopicsEmit.SYNC_DEVICE_RULE_FIELDS, {
          deviceId: device.ID,
          fields: dto.supportedFields,
        });
      } catch (err) {
        this.logger.error(`Failed to send device fields to upload microservice for device ${device.ID}: ${err}`);
      }
    }

    if (dto.platform?.devices?.length) {
      for (const d of dto.platform.devices) {
        await this.discoveryDeviceContext(d, device);
      }
    }

    return dto;
  }

  async discoveryMessage(discovery: DiscoveryMessageDto) {
    let device = this.deviceRepo.create(discovery.general.physicalDevice!);
    this.logger.debug("save device")
    await this.deviceRepo.save(device)

    if (discovery.discoveryType === DiscoveryType.GET_APP) {
      let compsCatalogId = Array.from(new Set(discovery.softwareData.platform.components.map(comp => comp.catalogId)))

      await this.setCompsOnDevice(device.ID, compsCatalogId)
    }

    const dm = new DiscoveryMessageEntity()
    dm.personalDevice = discovery.general.personalDevice;
    dm.situationalDevice = discovery.general.situationalDevice;
    dm.discoveryType = discovery.discoveryType
    dm.discoveryData = discovery.softwareData;
    dm.device = device

    // this.logger.debug(data.data);
    // if (data.data instanceof GetAppDiscoveryDto){
    //   this.logger.debug(data.data.formation)
    //   dm.formation = data.data.formation;
    //   dm.baseVersion = data.data.baseVersion;
    //   dm.previousVersion = data.data.previousVersion;
    // }else {
    //   dm.map = data.data
    // }    

    this.logger.verbose(`discovery message ${dm}`);
    this.discoveryMessageRepo.save(dm);

  }

  /**
   * Fixes components where the agent reports project ID as 0 but the project now exists in the database.
   * This happens when a pending version is accepted but the agent hasn't synced the updated project ID yet.
   */
  private async fixZeroProjectIds(components: ComponentStateDto[]): Promise<void> {
    const zeroIdComponents = components.filter(comp => {
      const [namePart] = comp.catalogId.split("@");
      const projectIdentifier = namePart?.split('.')[0] || namePart;
      return projectIdentifier === '0';
    });

    if (zeroIdComponents.length === 0) {
      return;
    }

    this.logger.debug(`Found ${zeroIdComponents.length} component(s) with project ID 0, attempting to resolve`);

    try {
      // Extract unique project names from zeroIdComponents to optimize the query
      const projectNames = new Set<string>();
      for (const comp of zeroIdComponents) {
        const [namePart] = comp.catalogId.split("@");
        const projectName = namePart.split('.').pop(); // Get the name part after '0.'
        if (projectName && projectName !== '0') {
          projectNames.add(projectName);
        }
      }

      if (projectNames.size === 0) {
        this.logger.debug(`No valid project names extracted from zero ID components`);
        return;
      }

      // Get only projects matching these names from project-management
      const response = await lastValueFrom(
        this.projectManagementClient.send(ProjectManagementTopics.GET_PROJECTS, {
          projectNames: Array.from(projectNames)
        })
      );
      
      // Handle both array response and paginated response
      const projects = Array.isArray(response) ? response : (response?.data || []);
      
      if (!projects || projects.length === 0) {
        this.logger.debug(`No projects found for names [${Array.from(projectNames).join(', ')}], components with ID 0 will be recorded as pending versions`);
        return;
      }

      // Build a map of project name -> project ID for quick lookup
      const nameToIdMap = new Map<string, number>();
      
      for (const project of projects) {
        const projectName = project.name || project.projectName;
        const projectId = project.id;
        
        if (projectName && projectId) {
          nameToIdMap.set(projectName, projectId);
        }
      }

      // Replace project ID 0 with the correct project ID based on name match
      for (const comp of zeroIdComponents) {
        const [namePart, version] = comp.catalogId.split("@");
        
        if (!version) {
          continue;
        }

        const projectName = namePart.split('.').pop();
        
        if (!projectName) {
          continue;
        }
        
        // Find matching project by name
        const projectId = nameToIdMap.get(projectName);
        
        if (projectId) {
          const newCatalogId = `${projectId}.${projectName}@${version}`;
          
          this.logger.log(`Resolved ${comp.catalogId} to ${newCatalogId}`);
          comp.catalogId = newCatalogId;
        } else {
          this.logger.debug(
            `No matching project found for name '${projectName}' in ${comp.catalogId}, ` +
            `will be recorded as pending version`
          );
        }
      }
    } catch (err) {
      this.logger.error(`Error fetching projects from project-management: ${err}`);
      // If we can't get projects, components with ID 0 will be recorded as pending versions
    }
  }

  private async setCompsOnDeviceV2(deviceId: string, compsState: ComponentStateDto[]) {
    this.logger.log(`Set components on device '${deviceId}' (v2) — processing ${compsState?.length ?? 0} component(s)`);
    const compsCatalogId = Array.from(new Set(compsState.map(comp => comp.catalogId)));

    const normalizeId = (id: string) => {
      const [namePart, version] = id.split("@");
      return `${namePart.split('.').pop() || ""}@${version || ""}`;
    };

    const normalizedCompsCatalogId = compsCatalogId.map(normalizeId);

    let deviceComps: DeviceComponentStateDto[] = []

    // Find the registered components of the device, and set as uninstall if they are not in the list
    const allDeviceComps = await this.deviceComponentRepo.find({
      select: { device: { ID: true }, release: { catalogId: true } },
      where: {
        device: { ID: deviceId },
        state: Not(In([DeviceComponentStateEnum.PUSH, DeviceComponentStateEnum.OFFERING]))
      },
      relations: { release: true, device: true }
    });

    const uninstalledComps = allDeviceComps.filter(c =>
      !compsCatalogId.includes(c.release.catalogId) &&
      !normalizedCompsCatalogId.includes(normalizeId(c.release.catalogId))
    );

    if (uninstalledComps.length) {
      this.logger.debug(
        `Set comps that not exist in message [${uninstalledComps
          .map(c => c.release?.catalogId ?? 'unknown')
          .join(', ')}] as uninstalled`
      );
    }
    uninstalledComps.forEach(c => {
      let dss = new DeviceComponentStateDto()
      dss.catalogId = c.release.catalogId;
      dss.deviceId = c.device.ID;
      dss.state = DeviceComponentStateEnum.UNINSTALLED;
      deviceComps.push(dss);
    })


    // Query upload service for releases instead of direct DB access
    const projectNames = Array.from(new Set(
      compsCatalogId.map(id => {
        const [namePart] = id.split("@");
        return namePart.split('.').pop() || "";
      }).filter(name => name && name !== '0')
    ));

    let comps: string[] = [];
    
    try {
      // Fetch releases for each project from upload service
      const releasePromises = projectNames.map(async (projectName) => {
        try {
          const releases: ReleaseDto[] = await lastValueFrom(
            this.uploadClient.send(UploadTopics.GET_RELEASES, { projectIdentifier: projectName })
          );
          return releases.map(r => r.id);
        } catch (err) {
          this.logger.debug(`Could not fetch releases for project ${projectName}: ${err}`);
          return [];
        }
      });
      
      const allReleases = await Promise.all(releasePromises);
      comps = allReleases.flat();
      
      // Also include exact catalogId matches
      const exactMatches = comps.filter(c => compsCatalogId.includes(c));
      this.logger.debug(`Found ${comps.length} total releases from upload service, ${exactMatches.length} exact matches`);
    } catch (err) {
      this.logger.error(`Error fetching releases from upload service: ${err}`);
      // Continue with empty comps array to avoid breaking the flow
    }

    const normalizedComps = comps.map(normalizeId);
    const uninstalledCatalogIds = new Set(uninstalledComps.map(u => u.release.catalogId));

    // Detect and record unknown versions (not found in releases)
    const unknownVersions = compsState.filter(compState => {
      const catalogId = compState.catalogId;
      
      // Parse the catalogId (format: "namespace.projectName@version" or "projectName@version")
      const [namePart, version] = catalogId.split("@");
      
      // Skip if the identifier part starts with 0 AND it's in OFFERING or PUSH state
      // (scenario 1 - agent hasn't synced the project identifier yet, will be resolved by agent)
      // But if it's INSTALLED/DEPLOYED/etc, the 0 might be the real identifier
      if (namePart && namePart.startsWith('0') && 
          (compState.state === DeviceComponentStateEnum.OFFERING || 
           compState.state === DeviceComponentStateEnum.PUSH)) {
        return false;
      }
      
      // Check if this version exists in our database
      const isKnown = comps.includes(catalogId) || normalizedComps.includes(normalizeId(catalogId));
      return !isKnown;
    });

    // Record unknown versions for later review
    if (unknownVersions.length > 0) {
      this.logger.warn(`Found ${unknownVersions.length} unknown version(s) from device ${deviceId}: ${unknownVersions.map(v => v.catalogId).join(', ')}`);
      
      for (const compState of unknownVersions) {
        const catalogId = compState.catalogId;
        const [namePart, version] = catalogId.split("@");
        const projectName = namePart?.split('.').pop() || namePart;
        
        // Always record, even if version or projectName are missing - we want to know about malformed IDs too
        this.pendingVersionService.recordPendingVersion(
          projectName || 'unknown',
          version || 'unknown',
          deviceId,
          catalogId
        ).catch(err => {
          this.logger.error(`Failed to record pending version ${catalogId}: ${err.message}`);
        });
      }
    }

    compsState
      .filter(cs => comps.includes(cs.catalogId) || normalizedComps.includes(normalizeId(cs.catalogId)))
      .forEach(c => deviceComps.push(DeviceComponentStateDto.fromParent(c, deviceId)))

    deviceComps = deviceComps
      .map(c => {
        if (comps.includes(c.catalogId) || uninstalledCatalogIds.has(c.catalogId)) return c
        const correctCatalogId = comps.find(comp => normalizeId(comp) === normalizeId(c.catalogId))
        if (correctCatalogId) {
          c.catalogId = correctCatalogId
          return c
        }
        return null
      })
      .filter((c): c is DeviceComponentStateDto => c !== null);

    this.logger.debug(`comps list to update or save ${deviceComps}`);
    await this.deviceService.updateDeviceSoftware(deviceComps);
  }


  private async setCompsOnDevice(deviceId: string, compsCatalogId: string[]) {
    // Query upload service for releases
    const projectNames = Array.from(new Set(
      compsCatalogId.map(id => {
        const [namePart] = id.split("@");
        return namePart.split('.').pop() || "";
      }).filter(name => name && name !== '0')
    ));

    let comps: ReleaseDto[] = [];
    
    try {
      // Fetch releases for each project from upload service
      const releasePromises = projectNames.map(async (projectName) => {
        try {
          const releases: ReleaseDto[] = await lastValueFrom(
            this.uploadClient.send(UploadTopics.GET_RELEASES, { projectIdentifier: projectName })
          );
          return releases.filter(r => compsCatalogId.includes(r.id));
        } catch (err) {
          this.logger.debug(`Could not fetch releases for project ${projectName}: ${err}`);
          return [];
        }
      });
      
      const allReleases = await Promise.all(releasePromises);
      comps = allReleases.flat();
    } catch (err) {
      this.logger.error(`Error fetching releases from upload service: ${err}`);
    }

    let deviceComps: DeviceComponentStateDto[] = []

    let currentInstalledComps = await this.deviceComponentRepo.find({
      where: {
        state: In([DeviceComponentStateEnum.INSTALLED, DeviceComponentStateEnum.UNINSTALLED]),
        device: { ID: deviceId }
      },
      relations: { release: true, device: true }
    });

    this.logger.debug(`get all current installed comps ${currentInstalledComps.map(c => c.release.catalogId)}`);
    currentInstalledComps.forEach(c => {
      if (!compsCatalogId.includes(c.release.catalogId)) {
        let dss = new DeviceComponentStateDto()
        dss.catalogId = c.release.catalogId;
        dss.deviceId = c.device.ID;
        dss.state = DeviceComponentStateEnum.UNINSTALLED;
        deviceComps.push(dss);
      }
    })
    for (let comp of comps) {
      let dss = new DeviceComponentStateDto()
      dss.catalogId = comp.id;
      dss.deviceId = deviceId;
      dss.state = DeviceComponentStateEnum.INSTALLED;

      deviceComps.push(dss);
    }
    this.logger.debug(`comps list to update or save ${deviceComps}`);
    await this.deviceService.updateDeviceSoftware(deviceComps);
  }

  async imPushDiscoveryDevices(devicesDiscovery: DeviceDiscoverDto[]): Promise<void> {
    this.logger.log("IM push discovery of devices")

    let devicesList = devicesDiscovery.map(d => d.deviceId);
    this.logger.debug(`query for devices ${devicesList}`);
    let devices = await this.deviceRepo.find({ select: ['ID', 'lastUpdatedDate'], where: { ID: In(devicesList) } })

    devicesDiscovery.map(async dvcDsc => {
      let matchingDevice = devices.find(dvc => dvcDsc.deviceId == dvc.ID);
      let comps = dvcDsc.comps.map(comp => ({ catalogId: comp } as any));

      this.logger.log(`Try to update device ID: ${dvcDsc.deviceId}, with components: ${JSON.stringify(comps)}`)
      if (!matchingDevice) {
        this.logger.debug(`Device ID: ${dvcDsc.deviceId}, is not found. create a new device record`);
        let device = this.deviceRepo.create();
        device.ID = dvcDsc.deviceId;
        matchingDevice = await this.deviceRepo.save(device);

        await this.setCompsOnDevice(dvcDsc.deviceId, dvcDsc.comps);

        matchingDevice.lastUpdatedDate = dvcDsc.produceTime;
        this.deviceRepo.save(matchingDevice).catch(err =>
          this.logger.error(`Unable to save comp to device, maybe because of component doesn't exist. error message: ${err}`));

      } else if (matchingDevice.lastUpdatedDate < new Date(dvcDsc.produceTime)) {
        this.logger.debug(`Update device ID: ${dvcDsc.deviceId}.`);

        await this.setCompsOnDevice(dvcDsc.deviceId, dvcDsc.comps);

        matchingDevice.lastUpdatedDate = dvcDsc.produceTime;
        this.deviceRepo.save(matchingDevice).catch(err =>
          this.logger.error(`Unable to save comp to device, maybe because of component doesn't exist. error message: ${err}`));
      } else {
        this.logger.debug(`Device ID: ${dvcDsc.deviceId} already updated.`);
      }
    })
  }

  async imPullDiscoveryDevices(devicesDiscovery: DeviceDiscoverDto[]): Promise<DeviceDiscoverResDto[]> {
    this.logger.log("IM pull discovery of devices")

    let query = this.deviceRepo.createQueryBuilder('d')
    query.select(["d.ID", "d.lastUpdatedDate"])

    for (const [index, obj] of devicesDiscovery.entries()) {
      let id_key = 'id_' + index;
      let date_key = 'date_' + index;
      query.orWhere(new Brackets(q => {
        q.where('d.ID = :' + id_key)
        q.andWhere('d.lastUpdatedDate > :' + date_key)
      }))
        .setParameter(id_key, obj.deviceId)
        .setParameter(date_key, obj.produceTime)
    }
    query.leftJoinAndSelect("d.components", "dc");
    query.leftJoinAndSelect("dc.release", "r");
    query.leftJoinAndSelect("r.project", "p");

    let res = await query.getMany();
    this.logger.log(`Found ${res.length} not updated devices`);

    let devicesDiscoverRes: DeviceDiscoverResDto[] = [];
    for (let device of res) {
      let ddr = new DeviceDiscoverResDto();
      ddr.deviceId = device.ID;
      ddr.produceTime = device.lastUpdatedDate;
      ddr.comps = device.components.map(dc => ComponentV2Dto.fromEntity(dc.release));

      devicesDiscoverRes.push(ddr);
    }

    this.logger.verbose("devices discover response: " + JSON.stringify(devicesDiscoverRes));

    return devicesDiscoverRes;
  }

  async updateMTlsStatusForDevice(mTlsStatus: MTlsStatusDto) {
    this.logger.debug("discovery mtls status ");

    const device = this.deviceRepo.create({ ID: mTlsStatus.deviceId })
    await this.deviceRepo.save(device)

    const dm = new DiscoveryMessageEntity()
    dm.device = device,
      dm.mTlsStatus = mTlsStatus.status
    dm.discoveryType = DiscoveryType.MTLS
    this.discoveryMessageRepo.save(dm);
  }

  /**
   * Collects all applicable restrictions for a device based on:
   * - Device ID
   * - Device Type(s)
   * - OS Type
   */
  async getRestrictionsForDevice(deviceId: string): Promise<any[]> {
    this.logger.log(`Getting restrictions for device ${deviceId}`);

    try {
      // Get the device with its types and platform info
      const device = await this.deviceRepo.findOne({
        where: { ID: deviceId },
        relations: ['deviceType', 'platform'],
      });

      if (!device) {
        this.logger.warn(`Device ${deviceId} not found`);
        return [];
      }

      // Extract device type names
      const deviceTypeNames = device.deviceType?.map(dt => dt.name) || [];
      
      // Get OS type from the platform or device info (you may need to adjust this based on your data structure)
      // For now, we'll query by device ID and device types. OS can be added if available.
      const osType = device.platform?.name; // Adjust this based on where OS info is stored

      // Collect all restrictions
      const allRestrictions: any[] = [];

      // 1. Get restrictions by device ID
      if (deviceId) {
        const deviceQuery = {
          type: RuleType.RESTRICTION,
          isActive: true,
          deviceId: deviceId,
        };
        const deviceRestrictions = await this.ruleService.findAll(deviceQuery);
        allRestrictions.push(...deviceRestrictions);
      }

      // 2. Get restrictions by device types
      for (const typeName of deviceTypeNames) {
        const typeQuery = {
          type: RuleType.RESTRICTION,
          isActive: true,
          deviceTypeName: typeName,
        };
        const typeRestrictions = await this.ruleService.findAll(typeQuery);
        allRestrictions.push(...typeRestrictions);
      }

      // 3. Get restrictions by OS type (if available)
      if (osType) {
        const osQuery = {
          type: RuleType.RESTRICTION,
          isActive: true,
          osType: osType,
        };
        const osRestrictions = await this.ruleService.findAll(osQuery);
        allRestrictions.push(...osRestrictions);
      }

      // Remove duplicates based on rule ID
      const uniqueRestrictions = Array.from(
        new Map(allRestrictions.map(rule => [rule.id, rule])).values()
      );

      this.logger.debug(`Found ${uniqueRestrictions.length} unique restriction(s) for device ${deviceId}`);

      // Convert to RuleDefinition format
      return uniqueRestrictions.map(rule => this.ruleService.ruleEntityToDefinition(rule));
    } catch (err: any) {
      this.logger.error(`Error getting restrictions for device ${deviceId}: ${err.message}`);
      return [];
    }
  }
}
