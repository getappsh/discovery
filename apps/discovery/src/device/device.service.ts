import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { DeviceComponentEntity, DeviceComponentStateEnum, DeviceEntity, DeviceMapStateEntity, DeviceMapStateEnum, MapEntity, OrgGroupEntity, OrgUIDEntity, ReleaseEntity, ReleaseStatusEnum, UploadVersionEntity } from '@app/common/database/entities';
import { DeviceRegisterDto, DeviceContentResDto, DeviceMapDto, DevicesStatisticInfo, DeviceMapStateDto } from '@app/common/dto/device';
import { MapDto } from '@app/common/dto/map';
import { MapDevicesDto } from '@app/common/dto/map/dto/all-maps.dto';
import { DeviceDto } from '@app/common/dto/device/dto/device.dto';
import { InventoryDeviceUpdatesDto } from '@app/common/dto/map/dto/inventory-device-updates-dto';
import { DeviceRepoService } from '../modules/device-client-repo/device-repo.service';
import { DevicePutDto } from '@app/common/dto/device/dto/device-put.dto';
import { DeviceSoftwareDto, DeviceComponentStateDto } from '@app/common/dto/device/dto/device-software.dto';
import { ReleaseChangedEventDto } from '@app/common/dto/upload';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { OfferingTopicsEmit } from '@app/common/microservice-client/topics';
import { Deprecated } from '@app/common/decorators';

@Injectable()
export class DeviceService {

  private readonly logger = new Logger(DeviceService.name);

  constructor(
    @InjectRepository(DiscoveryMessageEntity) private readonly discoveryMessageRepo: Repository<DiscoveryMessageEntity>,
    @InjectRepository(OrgUIDEntity) private readonly orgUIDRepo: Repository<OrgUIDEntity>,
    @InjectRepository(OrgGroupEntity) private readonly orgGroupRepo: Repository<OrgGroupEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(MapEntity) private readonly mapRepo: Repository<MapEntity>,
    @InjectRepository(DeviceMapStateEntity) private readonly deviceMapRepo: Repository<DeviceMapStateEntity>,
    @InjectRepository(DeviceComponentEntity) private readonly deviceCompRepo: Repository<DeviceComponentEntity>,
    @Inject(MicroserviceName.MICRO_DISCOVERY_SERVICE) private readonly discoveryMicroClient: MicroserviceClient,


    private deviceRepoS: DeviceRepoService
  ) {
  }

  async getRegisteredDevices(groups: string[]): Promise<DeviceDto[]> {
    this.logger.debug(`Get all registered devices, for groups ${groups}`);
    let groupsIntArray = groups?.map(Number).filter(num => !isNaN(num))
    if (groupsIntArray) {
      groupsIntArray = await this.getGroupsChildren(groupsIntArray);
    }
    const devices = await this.deviceRepo.find({
      relations: { orgUID: { group: true } },
      where: groupsIntArray ? { orgUID: { group: { id: In(groupsIntArray) } } } : {},
      order: { createdDate: "DESC" },
      take: 100
    })
    return this.deviceToDevicesDto(devices)
  }

  async getGroupsChildren(gid: number[]) {
    let ids = new Set(gid)
    let queryIds = gid
    while (queryIds.length !== 0) {
      let chields = await this.orgGroupRepo.find({ where: { parent: { id: In(queryIds) } }, relations: { parent: true } });
      queryIds = [];
      chields.forEach(c => {
        if (!ids.has(c.id)) {
          queryIds.push(c.id);
        }
        ids.add(c.id);
      })
    }
    return Array.from(ids)
  }

  async getDevicesSoftwareStatisticInfo(params: { [key: string]: string[] }): Promise<DevicesStatisticInfo> {

    const groups = params.groups
    const software = params.software

    this.logger.debug(`Get devices statistic info, ${groups ? "- groups=" + groups : ""} ${software ? "- software=" + software : ""}`);

    let groupsIntArray = groups?.map(Number).filter(num => !isNaN(num))
    if (groupsIntArray) {
      groupsIntArray = await this.getGroupsChildren(groupsIntArray);
    }

    let devices = await this.deviceRepo.find({
      select: { components: { state: true, release: { catalogId: true, latest: true } }, orgUID: { group: { id: false } } },
      relations: { orgUID: { group: true }, components: { release: true } },
      where: groupsIntArray ? { orgUID: { group: { id: In(groupsIntArray) } } } : {},
    });

    let count = { sum: devices.length, devices: devices.map(d => d.ID) }

    if (software) {
      devices = devices.map(d => { d.components = d.components.filter(c => software.includes(c.release.catalogId)); return d })
    }

    let updatedDvs = devices.map(dvc => {
      if (dvc.components.length && software
        ? dvc.components.some(comp => !(comp.state == DeviceComponentStateEnum.INSTALLED && comp.release.latest == true))
        : dvc.components.some(comp => comp.state != DeviceComponentStateEnum.INSTALLED))
        return { isUpdate: false, id: dvc.ID }
      else return { isUpdate: true, id: dvc.ID }
    })
      .filter(d => d.isUpdate).map(d => d.id)

    let dvsOnUpdateProcess = devices.map(dvc => {
      if (dvc.components.length && dvc.components.some(comp => comp.state == DeviceComponentStateEnum.PUSH || comp.state == DeviceComponentStateEnum.DELIVERY || comp.state == DeviceComponentStateEnum.DEPLOY))
        return { onUpdateProc: true, id: dvc.ID }
      else return { onUpdateProc: false, id: dvc.ID }
    }).filter(d => d.onUpdateProc).map(d => d.id)


    let info: DevicesStatisticInfo = {
      count,
      updated: { sum: updatedDvs.length, devices: updatedDvs },
      onUpdateProcess: { sum: dvsOnUpdateProcess.length, devices: dvsOnUpdateProcess },
      updateError: { sum: 0, devices: [] }
    }

    this.logger.log(`Device info ${JSON.stringify(info)}`);

    return info
  }

  async getDevicesMapStatisticInfo(params: { [key: string]: string[] }) {

    const groups = params.groups
    const map = params.map

    this.logger.debug(`Get devices statistic info, ${groups ? "- groups=" + groups : ""} ${map ? "map=" + map : ""}`);

    let groupsIntArray = groups?.map(Number).filter(num => !isNaN(num))
    if (groupsIntArray) {
      groupsIntArray = await this.getGroupsChildren(groupsIntArray);
    }

    let devices = await this.deviceRepo.find({
      select: { maps: { state: true }, orgUID: { group: { id: false } } },
      relations: { orgUID: { group: true }, maps: { map: true } },
      where: groupsIntArray ? { orgUID: { group: { id: In(groupsIntArray) } } } : {},
    });

    let count = { sum: devices.length, devices: devices.map(d => d.ID) }

    if (map) {
      devices = devices.map(d => { d.maps = d.maps.filter(c => map.includes(c.map.catalogId)); return d })
    }

    let updatedDvs = devices.map(dvc => {
      if (dvc.maps.some(map => map.state !== DeviceMapStateEnum.INSTALLED))
        return { isUpdate: false, id: dvc.ID }
      else return { isUpdate: true, id: dvc.ID }
    })
      .filter(d => d.isUpdate).map(d => d.id)

    let dvsOnUpdateProcess = devices.map(dvm => {
      if (dvm.maps.some(map => map.state == DeviceMapStateEnum.PUSH || map.state == DeviceMapStateEnum.DELIVERY || map.state == DeviceMapStateEnum.IMPORT))
        return { onUpdateProc: true, id: dvm.ID }
      else return { onUpdateProc: false, id: dvm.ID }
    }).filter(d => d.onUpdateProc).map(d => d.id)


    let info: DevicesStatisticInfo = {
      count,
      updated: { sum: updatedDvs.length, devices: updatedDvs },
      onUpdateProcess: { sum: dvsOnUpdateProcess.length, devices: dvsOnUpdateProcess },
      updateError: { sum: 0, devices: [] }
    }

    this.logger.log(`Device info ${JSON.stringify(info)}`);

    return info
  }

  async putDeviceProperties(p: DevicePutDto): Promise<DevicePutDto> {
    this.logger.log(`Put props for device ${p.deviceId}`);
    return await this.deviceRepoS.setDevice(p)
  }


  // TODO write test
  async getDeviceMaps(deviceId: string): Promise<DeviceMapDto> {
    this.logger.debug(`get maps for device ${deviceId}`);

    let deviceEntity = await this.deviceRepo.findOne({
      where: {
        ID: deviceId
      },
      order: { createdDate: "DESC" },
      relations: {
        maps: { map: { mapProduct: true } }
      },
    })
    if (!deviceEntity) {
      this.logger.error(`device ${deviceId} not exits`)
      throw new BadRequestException("Device not exits")
    }

    const discoveryMes = await this.discoveryMessageRepo.findOne({
      where: { device: { ID: deviceId } },
      order: { lastUpdatedDate: "DESC" },
    })

    return DeviceMapDto.fromDeviceMapEntity(deviceEntity, discoveryMes)
  }

  async deviceInstalled(deviceId: string): Promise<DeviceContentResDto> {
    this.logger.debug(`get software and map installed on device: ${deviceId}`)
    let deviceContent = new DeviceContentResDto()

    let device = await this.deviceRepo.findOne({ where: { ID: deviceId }, relations: { components: true, maps: { map: true } } });
    if (!device) {
      throw new BadRequestException('Device not found');
    }
    deviceContent.maps = device.maps.filter(map => map.state == DeviceMapStateEnum.INSTALLED).map(map => MapDto.fromMapEntity(map.map))

    return deviceContent
  }

  // Device - get map
  // TODO write test
  @Deprecated()
  async registerMapToDevice(existsMap: MapEntity, deviceId: string) {
    this.logger.log(`register map catalog id ${existsMap.catalogId} to device ${deviceId}`)
    try {
      let device = await this.deviceRepo.findOne({ where: { ID: deviceId }, relations: { maps: { map: true } } })
      // let device = await this.deviceRepo.createQueryBuilder("device")
      //   // .leftJoin("device.maps", "dm").addSelect("dm.map")
      //   .leftJoinAndSelect("device.maps", "dm")
      //   .leftJoinAndSelect("dm.map", "map")
      //   .where("device.ID = :deviceId", { deviceId })
      //   .andWhere("map.catalogId = :mapId", { mapId: existsMap.boundingBox })
      //   .getOne();

      if (!device) {
        const newDevice = this.deviceRepo.create()
        newDevice.ID = deviceId
        device = await this.deviceRepo.save(newDevice)
      }

      if (!device.maps || device.maps.length == 0 || !device.maps.find(map => map.map.catalogId == existsMap.catalogId)) {

        let dms = new DeviceMapStateDto()
        dms.catalogId = existsMap.catalogId;
        dms.deviceId = device.ID;
        dms.state = DeviceMapStateEnum.IMPORT;

        this.updateDeviceMap(dms);
      }

    } catch (error) {
      this.logger.error(error.toString())
    }
  }

  // TODO write test
  async registerMapInventoryToDevice(inventory: InventoryDeviceUpdatesDto) {
    this.logger.log(`Register map inventory to device - ${inventory.deviceId}`)

    try {
      let deviceMaps = [];
      const device = await this.deviceRepoS.getOrCreateDevice(inventory.deviceId)

      let mapsOnDevice = await this.deviceMapRepo.find({ where: { state: In([DeviceMapStateEnum.INSTALLED, DeviceMapStateEnum.DELIVERY, DeviceMapStateEnum.IMPORT, DeviceMapStateEnum.UNINSTALLED]), device: { ID: device.ID } }, relations: { map: true, device: true } });
      mapsOnDevice.forEach(m => {
        if (!(m.map.catalogId in inventory.inventory)) {
          let dms = new DeviceMapStateDto()
          dms.catalogId = m.map.catalogId;
          dms.deviceId = inventory.deviceId;
          dms.state = DeviceMapStateEnum.UNINSTALLED;
          deviceMaps.push(dms);
        }
      });

      this.logger.debug(`Uninstalled ${deviceMaps.length} maps`)

      Object.entries(inventory.inventory).forEach(([catalogId, state]) => {
        const map = inventory.maps.find(map => map.catalogId === catalogId);
        if (map) {
          let dms = new DeviceMapStateDto()
          dms.catalogId = catalogId;
          dms.deviceId = inventory.deviceId;
          dms.state = state;
          deviceMaps.push(dms);
        }
      })
      this.logger.debug(`map list to update or save ${deviceMaps}`);
      this.updateDeviceMap(deviceMaps);

    } catch (error) {
      this.logger.error(error)
    }
  }

  // TODO write test
  async getRequestedMaps(): Promise<MapDto[]> {
    this.logger.debug('get all requested maps with devices');

    let allMapEntity = await this.mapRepo.find({
      order: { createDateTime: "DESC" },
      relations: { mapProduct: true },
      take: 70
    })
    // let allMapEntity = await this.mapRepo.createQueryBuilder("map")
    //   .innerJoin("map.devices", "device")
    //   .getMany()

    let allMap = allMapEntity.map(entity => MapDto.fromMapEntity(entity))

    return allMap

  }

  // TODO write test
  async mapById(catalogId: string): Promise<MapDevicesDto> {
    this.logger.debug(`get map with catalog id ${catalogId} with its devices`);

    let mapEntity = await this.mapRepo.findOne({ where: { catalogId }, relations: { devices: { device: true }, mapProduct: true } })
    if (!mapEntity) {
      this.logger.error(`map of catalog id ${catalogId} not exits`)
      throw new BadRequestException("Map not exits")
    }
    
    const devices = mapEntity.devices.map(device => device.device)

    let mepDeviceEntity = await this.deviceToDevicesDto(devices)
    return MapDevicesDto.fromMapEntity(mapEntity, mepDeviceEntity)
  }

  async deviceToDevicesDto(devices: DeviceEntity[]): Promise<DeviceDto[]> {
    const ids = devices.map(device => device.ID);

    if (ids.length === 0) {
      return []; 
    }
    
    const discoveries = await this.discoveryMessageRepo.createQueryBuilder("discovery")
      .where("discovery.deviceID IN  (:...ids)", { ids })
      .orderBy("discovery.deviceID")
      .addOrderBy("discovery.lastUpdatedDate", "DESC")
      .distinctOn(["discovery.deviceID"])
      .loadAllRelationIds()
      .getMany();

    return devices.map(device => {
      const dis = discoveries.find(dis => (dis?.device || "") as string == device.ID)
      return DeviceDto.fromDeviceEntity(device, dis);

    })
  }


  registerSoftware(data: DeviceRegisterDto) {
    this.logger.log(`register data: ${data}`);
    // TODO
    return ''
  }


  async getDeviceSoftwares(deviceId: string): Promise<DeviceSoftwareDto> {
    this.logger.debug(`get softwares for device ${deviceId}`);
    let device = await this.deviceRepo.findOne({ 
      where: { ID: deviceId }, 
      relations: { components: { release: { project: true } }},
      select: { components: {
        id: true, state: true, error: true,
        release: {
          version: true, catalogId: true, releaseNotes: true,
          status: true, createdAt: true, updatedAt: true,
          project: {name: true, projectType: true, id: true}
        },
      }}
    });

    if (!device) {
      this.logger.error(`device ${deviceId} not exits`)
      throw new BadRequestException("Device not exits")
    }
    let deviceDto = (await this.deviceToDevicesDto([device]))[0] || {} as DeviceDto;

    return DeviceSoftwareDto.fromDeviceComponentsEntity(device.components, deviceDto);
  }


  async updateDeviceMap(state: DeviceMapStateDto | DeviceMapStateDto[]) {
    this.logger.log("Update device map state")
    let states = Array.isArray(state) ? state : [state]

    let uninstalled = states.filter(s => s.state === DeviceMapStateEnum.UNINSTALLED || s.state === DeviceMapStateEnum.DELETED);
    this.logger.debug(`Maps that are uninstalled form the device: ${JSON.stringify(uninstalled)}`)
    for (let s of uninstalled) {
      this.deviceMapRepo.delete({ map: { catalogId: s.catalogId }, device: { ID: s.deviceId } });
    }

    states = states.filter(s => s.state !== DeviceMapStateEnum.UNINSTALLED && s.state !== DeviceMapStateEnum.DELETED)

    let deviceMaps = []
    for (let s of states) {
      if (s.state === DeviceMapStateEnum.INSTALLED) {
        this.sendMapInstallEvent2Offering(s);
      }
      let dm = new DeviceMapStateEntity()
      dm.map = { catalogId: s.catalogId } as MapEntity;
      dm.device = { ID: s.deviceId } as DeviceEntity;
      dm.state = s.state;

      deviceMaps.push(dm);
    }
    this.logger.debug(`Maps to update or save: ${deviceMaps}`);

    try {
      if (deviceMaps) {
        await this.deviceMapRepo.save(deviceMaps)
      }
    } catch (err) {
      this.logger.debug("failed to insert try to update")

      let queryBuilder = this.deviceMapRepo.createQueryBuilder("entity");
      queryBuilder.select("entity.device_ID")
      deviceMaps.forEach((obj, index) => {
        queryBuilder.orWhere(
          'entity.device_ID = :id' + index + ' AND entity.map_catalog_id = :catalogId' + index,
          { ['id' + index]: obj?.device?.ID, ['catalogId' + index]: obj.map?.catalogId },
        );
      });
      let ids = (await queryBuilder.getRawMany()).map(d => d.device_ID);

      let fdm = deviceMaps.filter(d => !(d.state == DeviceMapStateEnum.PUSH && ids.includes(d?.device?.ID)));
      if (fdm) {
        this.logger.debug(`updated map list to update or save ${fdm}`);

        this.deviceMapRepo.upsert(fdm, ['device', 'map']).catch(err =>
          this.logger.error(`failed to update device map state: ${err}`)
        )
      }
    }
  }
  async updateDeviceSoftware(state: DeviceComponentStateDto | DeviceComponentStateDto[]) {
    this.logger.log("Update device software state")
    let states = Array.isArray(state) ? state : [state]

    let uninstalled = states.filter(s => s.state === DeviceComponentStateEnum.UNINSTALLED);
    this.logger.debug(`Components that are uninstalled form the device: ${JSON.stringify(uninstalled)}`)
    for (let s of uninstalled) {
      this.deviceCompRepo.delete({ release: { catalogId: s.catalogId }, device: { ID: s.deviceId } });
    }

    let deleted = states.filter(s => s.state === DeviceComponentStateEnum.DELETED);
    this.logger.debug(`Components that are deleted form the device: ${JSON.stringify(deleted)}`)
    for(let s of deleted){
      this.deviceCompRepo.delete({ 
        release: { catalogId: s.catalogId }, 
        device: { ID: s.deviceId },
        state: Not(In([DeviceComponentStateEnum.DEPLOY, DeviceComponentStateEnum.INSTALLED, DeviceComponentStateEnum.UNINSTALLED]))
       });
    }

    states = states.filter(s => s.state !== DeviceComponentStateEnum.UNINSTALLED &&  s.state !== DeviceComponentStateEnum.DELETED)
    let deviceComps = []
    for (let s of states) {
      if (s.state === DeviceComponentStateEnum.INSTALLED) {
        this.sendSoftwareInstallEvent2Offering(s);
      }
      let dc = new DeviceComponentEntity()
      dc.release = { catalogId: s.catalogId } as ReleaseEntity;
      dc.device = { ID: s.deviceId } as DeviceEntity;
      dc.state = s.state;
      dc.error = s.error ?? null

      deviceComps.push(dc);
    }
    this.logger.debug(`Components to update or save: ${deviceComps}`);

    try {
      if (deviceComps) {
        await this.deviceCompRepo.save(deviceComps)
      }
    } catch (err) {
      this.logger.debug("failed to insert try to update")

      let queryBuilder = this.deviceCompRepo.createQueryBuilder("entity");
      queryBuilder.select("entity.device_ID")
      deviceComps.forEach((obj, index) => {
        queryBuilder.orWhere(
          'entity.device_ID = :id' + index + ' AND entity.release_catalog_id = :catalogId' + index,
          { ['id' + index]: obj?.device?.ID, ['catalogId' + index]: obj.component?.catalogId },
        ).andWhere('entity.state != :state', { state: DeviceComponentStateEnum.OFFERING });
      });
      let ids = (await queryBuilder.getRawMany()).map(d => d.device_ID);

      let fdc = deviceComps.filter(d => !((d.state == DeviceComponentStateEnum.PUSH || d.state == DeviceComponentStateEnum.OFFERING) && ids.includes(d?.device?.ID)));
      if (fdc) {
        this.logger.debug(`updated comps list to update or save ${fdc}`);

        this.deviceCompRepo.upsert(fdc, ['device', 'release']).catch(err =>
          this.logger.error(`failed to update device component state: ${err}`)
        )
      }
    }
  }

  async sendSoftwareInstallEvent2Offering(event: DeviceComponentStateDto) {
    if (event.state !== DeviceComponentStateEnum.INSTALLED) {
      return
    }
    this.logger.verbose(`send software installed event`);
    await this.discoveryMicroClient.emit(OfferingTopicsEmit.DEVICE_SOFTWARE_EVENT, event);
  }

  async sendMapInstallEvent2Offering(event: DeviceMapStateDto) {
    if (event.state !== DeviceMapStateEnum.INSTALLED) {
      return
    }
    this.logger.verbose(`Send map installed event`);
    await this.discoveryMicroClient.emit(OfferingTopicsEmit.DEVICE_MAP_EVENT, event);
  }

  async releaseChangedEvent(dto: ReleaseChangedEventDto) {
    this.logger.log(`Release event for catalogId : ${dto.catalogId}, event ${dto.event}`);
    if (dto.event !== ReleaseStatusEnum.RELEASED) {
      this.logger.log(`Remove offering or push from DeviceSoftware state`);
      this.deviceCompRepo.delete({ release: { catalogId: dto.catalogId }, state: In([DeviceComponentStateEnum.PUSH, DeviceComponentStateEnum.OFFERING])});
    }
  }
}

