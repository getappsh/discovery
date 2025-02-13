import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Not, Repository } from 'typeorm';
import { DeviceComponentEntity, DeviceComponentStateEnum, DeviceEntity, DiscoveryType, PlatformEntity, ReleaseEntity, UploadVersionEntity } from '@app/common/database/entities';
import { ComponentStateDto, DiscoveryMessageDto, DiscoveryMessageV2Dto } from '@app/common/dto/discovery';
import { OfferingTopics } from '@app/common/microservice-client/topics';
import { MTlsStatusDto } from '@app/common/dto/device';
import { ComponentDto } from '@app/common/dto/discovery';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { DeviceDiscoverDto, DeviceDiscoverResDto } from '@app/common/dto/im';
import { DeviceService } from '../device/device.service';
import { DeviceComponentStateDto } from '@app/common/dto/device/dto/device-software.dto';

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @Inject(MicroserviceName.MICRO_DISCOVERY_SERVICE) private readonly discoveryMicroClient: MicroserviceClient,
    @InjectRepository(DiscoveryMessageEntity) private readonly discoveryMessageRepo: Repository<DiscoveryMessageEntity>,
    @InjectRepository(UploadVersionEntity) private readonly uploadVersionRepo: Repository<UploadVersionEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(DeviceComponentEntity) private readonly deviceComponentRepo: Repository<DeviceComponentEntity>,
    @InjectRepository(PlatformEntity) private readonly platformRepo: Repository<PlatformEntity>,
    @InjectRepository(ReleaseEntity) private readonly releaseRepo: Repository<ReleaseEntity>,
    private readonly deviceService: DeviceService,
  ) {
  }

  async discoveryDeviceContext(dto: DiscoveryMessageV2Dto){
    let device = this.deviceRepo.create(dto.general.physicalDevice);
    device.lastConnectionDate = new Date();
    device.formations = dto?.softwareData?.formations;
    device.platforms = await this.getOrCreatePlatforms(dto?.softwareData?.platforms)

    this.logger.debug("save device")
    await this.deviceRepo.save(device)

    if (dto.discoveryType === DiscoveryType.GET_APP){      
      await this.setCompsOnDeviceV2(device.ID, dto.softwareData.components)
    }

    const dm = new DiscoveryMessageEntity()
    dm.personalDevice = dto.general.personalDevice;
    dm.situationalDevice = dto.general.situationalDevice;
    dm.discoveryType = dto.discoveryType
    dm.discoveryData = dto.softwareData;
    dm.device = device

    this.logger.verbose(`discovery message ${dm}`);
    this.discoveryMessageRepo.save(dm);
  }

  private async getOrCreatePlatforms(platforms?: string[]) {
    this.logger.debug(`Get or create platforms: ${JSON.stringify(platforms)}`)
    if (!platforms) {
      return
    }
    if (platforms.length === 0) {
      return [];
    }
    return this.platformRepo.save(platforms.map(platform => {return { name: platform }}));
  }

  async discoveryMessage(discovery: DiscoveryMessageDto) {
    let device = this.deviceRepo.create(discovery.general.physicalDevice);
    this.logger.debug("save device")
    await this.deviceRepo.save(device)

    if (discovery.discoveryType === DiscoveryType.GET_APP){
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

  private async setCompsOnDeviceV2(deviceId: string, compsState: ComponentStateDto[]){
    const compsCatalogId = Array.from(new Set(compsState.map(comp => comp.catalogId)));

    let deviceComps: DeviceComponentStateDto[] = []

    // Find the registered components of the device, and set as uninstall if they are not in the list
    // TODO: maybe to delete them here
    let uninstalledComps = await this.deviceComponentRepo.find({
      select: {device: {ID: true}, release: {catalogId: true}},
      where: {
        device: {ID: deviceId},
        release: {catalogId: Not(In(compsCatalogId))}
      }, 
      relations: {release: true, device: true}});
      

    this.logger.debug(` comps ${uninstalledComps.map(c => c.release.catalogId)}`);
    uninstalledComps.forEach(c => {
      let dss = new DeviceComponentStateDto()
      dss.catalogId = c.release.catalogId;
      dss.deviceId = c.device.ID;
      dss.state = DeviceComponentStateEnum.UNINSTALLED;
      deviceComps.push(dss);
    })


    const comps = await this.releaseRepo
    .find({ where: { catalogId: In(compsCatalogId)}, select: {catalogId: true} })
    .then(comps => comps.map(c => c.catalogId));

    console.log({comps})

    compsState
      .filter(cs => comps.includes(cs.catalogId))
      .forEach(c => deviceComps.push(DeviceComponentStateDto.fromParent(c, deviceId)))
      
    console.log(deviceComps)
    this.logger.debug(`comps list to update or save ${deviceComps}`);
    await this.deviceService.updateDeviceSoftware(deviceComps);
  }


  private async setCompsOnDevice(deviceId: string, compsCatalogId: string[]){
    let comps = await this.uploadVersionRepo.find({ where: { catalogId: In(compsCatalogId) } })

    let deviceComps: DeviceComponentStateDto[] = []

    let currentInstalledComps = await this.deviceComponentRepo.find({
      where: {
        state: In([DeviceComponentStateEnum.INSTALLED, DeviceComponentStateEnum.UNINSTALLED]), 
        device: {ID: deviceId}
      }, 
      relations: {release: true, device: true}});

    this.logger.debug(`get all current installed comps ${currentInstalledComps.map(c => c.release.catalogId)}`);
    currentInstalledComps.forEach(c => {
      if (!compsCatalogId.includes(c.release.catalogId)){
          let dss = new DeviceComponentStateDto()
          dss.catalogId = c.release.catalogId;
          dss.deviceId = c.device.ID;
          dss.state = DeviceComponentStateEnum.UNINSTALLED;
          deviceComps.push(dss);
      }
    })
    for (let comp of comps){
      let dss = new DeviceComponentStateDto()
      dss.catalogId = comp.catalogId;
      dss.deviceId = deviceId;
      dss.state = DeviceComponentStateEnum.INSTALLED;
      
      deviceComps.push(dss);
    }
    this.logger.debug(`comps list to update or save ${deviceComps}`);
    await this.deviceService.updateDeviceSoftware(deviceComps);
  }

  checkUpdates(discoveryMessage: DiscoveryMessageDto) {
    return this.discoveryMicroClient.send(OfferingTopics.CHECK_UPDATES, discoveryMessage)
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
    query.leftJoinAndSelect("dc.component", "c");

    let res = await query.getMany();
    this.logger.log(`Found ${res.length} not updated devices`);

    let devicesDiscoverRes: DeviceDiscoverResDto[] = [];
    for (let device of res) {
      let ddr = new DeviceDiscoverResDto();
      ddr.deviceId = device.ID;
      ddr.produceTime = device.lastUpdatedDate;
      ddr.comps = device.components.map(dc => ComponentDto.fromUploadVersionEntity(dc.component));

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

  async onModuleInit() {
    this.discoveryMicroClient.subscribeToResponseOf([OfferingTopics.CHECK_UPDATES]);
    await this.discoveryMicroClient.connect()
  }
}
