import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity, DeviceMapStateEntity, DeviceMapStateEnum, MapEntity } from '@app/common/database/entities';
import { DeviceRegisterDto, DeviceContentResDto, DeviceMapDto } from '@app/common/dto/device';
import { ComponentDto } from '@app/common/dto/discovery';
import { CreateImportDto, CreateImportResDto, ImportStatusResDto, MapDto, MapProperties } from '@app/common/dto/map';
import { MapDevicesDto } from '@app/common/dto/map/dto/all-maps.dto';
import { DeviceDto } from '@app/common/dto/device/dto/device.dto';
import { InventoryDeviceUpdatesDto } from '@app/common/dto/map/dto/inventory-device-updates-dto';
import { DeviceRepoService } from '../modules/device-client-repo/device-repo.service';
import { DevicePutDto } from '@app/common/dto/device/dto/device-put.dto';

@Injectable()
export class DeviceService {
 
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    @InjectRepository(DiscoveryMessageEntity) private readonly discoveryMessageRepo: Repository<DiscoveryMessageEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(MapEntity) private readonly mapRepo: Repository<MapEntity>,
    @InjectRepository(DeviceMapStateEntity) private readonly deviceMapRepo: Repository<DeviceMapStateEntity>,
    private deviceRepoS: DeviceRepoService
  ) {
  }

  async getRegisteredDevices(): Promise<DeviceDto[]> {
    this.logger.debug(`Get all registered devices`);
    
    const devices = await this.deviceRepo.find({
      order: { createdDate: "DESC" },
      take: 100
    })
    return this.deviceToDevicesDto(devices)
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
    deviceContent.components = device.components.map(ComponentDto.fromUploadVersionEntity);
    deviceContent.maps = device.maps.filter(map => map.state == DeviceMapStateEnum.INSTALLED).map(map => MapDto.fromMapEntity(map.map))

    return deviceContent
  }

  // Device - get map

  // TODO write test
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

        let deviceMap = this.deviceMapRepo.create()
        deviceMap.device = device
        deviceMap.map = existsMap
        deviceMap.state = DeviceMapStateEnum.IMPORT
        this.deviceMapRepo.upsert(deviceMap, ['device', 'map'])
      }

    } catch (error) {
      this.logger.error(error.toString())
    }
  }

  // TODO write test
  async registerMapInventoryToDevice(inventory: InventoryDeviceUpdatesDto) {
    this.logger.log(`Register map inventory to device - ${inventory.deviceId}`)

    try {

      const device = await this.deviceRepoS.getOrCreateDevice(inventory.deviceId)
      await this.updateOrCreateDeviceMapE(device, { ...inventory.inventory }, inventory.maps)
      await this.deleteNotExistDeviceMapE(inventory.deviceId, inventory.inventory)

    } catch (error) {
      this.logger.error(error)
    }
  }

  async updateOrCreateDeviceMapE(device: DeviceEntity, inventory: Record<string, DeviceMapStateEnum>, maps: MapEntity[]) {

    // Update first the exist device map entity
    // TODO need query builder to select only map that in inventory list
    // TODO need handling when inventory is empty === {}
    // TODO pass repo queries if it possible to deviceRepoS

    const deviceMap = await this.deviceMapRepo.find({ where: { device: { ID: device.ID } }, relations: { device: true, map: true } })
    deviceMap.forEach(dM => {
      if (inventory[dM.map.catalogId]) {
        this.logger.debug(`Update state of map '${dM.map.catalogId}' for device '${device.ID}' to ${inventory[dM.map.catalogId]}`)
        dM.state = inventory[dM.map.catalogId]
        delete inventory[dM.map.catalogId]
      }
    })

    // Create the new device map entity
    const mapDeviceHs: DeviceMapStateEntity[] = []
    Object.keys(inventory).forEach(mapID => {
      const map = maps.find(m => m.catalogId == mapID)
      if (map) {
        this.logger.debug(`Create a device map entity for map '${map.catalogId}' and device '${device.ID}' with state of '${inventory[mapID]}'`)
        const dE = new DeviceMapStateEntity()
        dE.device = device
        dE.map = maps.find(m => m.catalogId == mapID)
        dE.state = inventory[mapID]
        mapDeviceHs.push(dE)
      }
    })

    // Save both
    await this.deviceMapRepo.upsert([...deviceMap, ...mapDeviceHs], ['device', 'map'])
  }

  async deleteNotExistDeviceMapE(deviceId: string, inventory: Record<string, DeviceMapStateEnum>) {

    // Delete device map entity of maps that not exist in inventory list      
    const queryBuilder = this.deviceRepo.createQueryBuilder("d")
      .innerJoinAndSelect('d.maps', 'dm', 'd.ID = :deviceId', { deviceId })
      .innerJoinAndSelect('dm.map', 'm');

    const ids = Object.keys(inventory)
    if (ids.length > 0) {
      queryBuilder.where("m.catalogId NOT IN (:...ids)", { ids });
    }

    const dm = await queryBuilder.getOne();

    if (dm) {
      this.logger.debug(`Delete device map entities of maps '${dm.maps.map(m => m.map.catalogId)}' for device '${dm.ID}'`)
      await this.deviceMapRepo.remove(dm.maps)
    }
  }


  // TODO write test
  async getRequestedMaps(): Promise<MapDto[]> {
    this.logger.debug('get all requested maps with devices');

    let allMapEntity = await this.mapRepo.find({
      order: { createDateTime: "DESC" },
      relations: {mapProduct: true},
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
    return await Promise.all(devices.map(async (device) => {
      const discoveryMes = await this.discoveryMessageRepo.findOne({
        where: { device: { ID: device.ID } },
        order: { lastUpdatedDate: "DESC" },
      })

      // if @discoveryMes is undefined it can by a fake device like TNG
      // return discoveryMes ? DeviceDto.fromDeviceEntity(device, discoveryMes) : null
      return DeviceDto.fromDeviceEntity(device, discoveryMes)
    }))
  }


  registerSoftware(data: DeviceRegisterDto) {
    this.logger.log(`register data: ${data}`);
    // TODO
    return ''
  }
}
