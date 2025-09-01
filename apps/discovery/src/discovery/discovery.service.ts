import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Not, Repository } from 'typeorm';
import { DeviceComponentEntity, DeviceComponentStateEnum, DeviceEntity, DeviceTypeEntity, DiscoveryType, PlatformEntity, ReleaseEntity } from '@app/common/database/entities';
import { ComponentStateDto, DiscoveryMessageDto, DiscoveryMessageV2Dto } from '@app/common/dto/discovery';
import { MTlsStatusDto } from '@app/common/dto/device';
import { DeviceDiscoverDto, DeviceDiscoverResDto } from '@app/common/dto/im';
import { DeviceService } from '../device/device.service';
import { DeviceComponentStateDto } from '@app/common/dto/device/dto/device-software.dto';
import { ComponentV2Dto } from '@app/common/dto/upload';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @InjectRepository(DiscoveryMessageEntity) private readonly discoveryMessageRepo: Repository<DiscoveryMessageEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(DeviceComponentEntity) private readonly deviceComponentRepo: Repository<DeviceComponentEntity>,
    @InjectRepository(PlatformEntity) private readonly platformRepo: Repository<PlatformEntity>,
    @InjectRepository(DeviceTypeEntity) private readonly deviceTypeRepo: Repository<DeviceTypeEntity>,
    @InjectRepository(ReleaseEntity) private readonly releaseRepo: Repository<ReleaseEntity>,
    private readonly deviceService: DeviceService,
  ) {
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

  private getDeviceTypeByToken(token: string): Promise<DeviceTypeEntity | null> {
    if (this.isNum(token)) {
      const id = parseInt(token, 10);
      return this.deviceTypeRepo.findOne({ where: { id } });
    } else {
      return this.deviceTypeRepo.findOne({ where: { name: token } });
    }
  }

  async setDeviceContext(dto: DiscoveryMessageV2Dto, parent?: DeviceEntity) {
    let device = await this.deviceRepo.findOne({ where: { ID: dto.id } })
      ?? this.deviceRepo.create({ ...dto.general?.physicalDevice, ID: dto.id });

    // If the device's last connection date is more recent than the snapshot date,
    // it means a newer message has already been processed for this device.

    // Wrap dto.snapshotDate in Date, as microservice data loses type.
    if (parent && device.lastConnectionDate && device.lastConnectionDate > new Date(dto.snapshotDate)) return device

    device.lastConnectionDate = parent ? dto.snapshotDate : new Date();
    device.formations = dto?.softwareData?.formations;

    if (dto.platform) device.platform = await this.getPlatformByToken(dto.platform.token) ?? undefined
    if (dto.deviceTypeToken) {
      const deviceTypes = await Promise.all(
        dto.deviceTypeToken.split(",").map(t => this.getDeviceTypeByToken(t))
      );
      device.deviceType = deviceTypes.filter((dt): dt is DeviceTypeEntity => dt !== null);
    }

    // Only device there is no of type platform, can be a device children
    if (!dto.platform) { device.parent = parent } else { device.parent = undefined }

    // Convert undefined properties to null before saving
    Object.keys(device).forEach(key => {
      if (device[key] === undefined) {
        device[key] = null;
      }
    });

    this.logger.debug("save device")
    return await this.deviceRepo.save(device)
  }

  async discoveryDeviceContext(dto: DiscoveryMessageV2Dto, parent?: DeviceEntity) {

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
        await this.setCompsOnDeviceV2(device.ID, dto?.softwareData?.components)
      }
    }

    if (dto.platform?.devices?.length) {
      dto.platform.devices.forEach(d => this.discoveryDeviceContext(d, device))
    }
  }

  async discoveryMessage(discovery: DiscoveryMessageDto) {
    let device = this.deviceRepo.create(discovery.general.physicalDevice);
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

  private async setCompsOnDeviceV2(deviceId: string, compsState: ComponentStateDto[]) {
    const compsCatalogId = Array.from(new Set(compsState.map(comp => comp.catalogId)));

    let deviceComps: DeviceComponentStateDto[] = []

    // Find the registered components of the device, and set as uninstall if they are not in the list
    // TODO: maybe to delete them here
    let uninstalledComps = await this.deviceComponentRepo.find({
      select: { device: { ID: true }, release: { catalogId: true } },
      where: {
        device: { ID: deviceId },
        release: { catalogId: Not(In(compsCatalogId)) },
        state: Not(In([DeviceComponentStateEnum.PUSH, DeviceComponentStateEnum.OFFERING]))
      },
      relations: { release: true, device: true }
    });


    this.logger.debug(` comps ${uninstalledComps.map(c => c.release.catalogId)}`);
    uninstalledComps.forEach(c => {
      let dss = new DeviceComponentStateDto()
      dss.catalogId = c.release.catalogId;
      dss.deviceId = c.device.ID;
      dss.state = DeviceComponentStateEnum.UNINSTALLED;
      deviceComps.push(dss);
    })


    const comps = await this.releaseRepo
      .find({ where: { catalogId: In(compsCatalogId) }, select: { catalogId: true } })
      .then(comps => comps.map(c => c.catalogId));


    compsState
      .filter(cs => comps.includes(cs.catalogId))
      .forEach(c => deviceComps.push(DeviceComponentStateDto.fromParent(c, deviceId)))

    this.logger.debug(`comps list to update or save ${deviceComps}`);
    await this.deviceService.updateDeviceSoftware(deviceComps);
  }


  private async setCompsOnDevice(deviceId: string, compsCatalogId: string[]) {
    let comps = await this.releaseRepo.find({ where: { catalogId: In(compsCatalogId) } })

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
      dss.catalogId = comp.catalogId;
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
}
