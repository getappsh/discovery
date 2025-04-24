import { DeviceTopics, DeviceTopicsEmit } from '@app/common/microservice-client/topics';
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern} from '@nestjs/microservices';
import { DeviceMapDto, DeviceMapStateDto, DeviceRegisterDto, DevicesStatisticInfo } from '@app/common/dto/device';
import { DeviceContentResDto } from '@app/common/dto/device';
import { MapDevicesDto } from '@app/common/dto/map/dto/all-maps.dto';
import { MapDto } from '@app/common/dto/map';
import { DeviceDto } from '@app/common/dto/device/dto/device.dto';
import { DeviceService } from './device.service';
import { RegisterMapDto } from '@app/common/dto/device/dto/register-map.dto';
import { InventoryDeviceUpdatesDto } from '@app/common/dto/map/dto/inventory-device-updates-dto';
import { DevicePutDto } from '@app/common/dto/device/dto/device-put.dto';
import { AndroidConfigDto, WindowsConfigDto } from '@app/common/dto/device/dto/device-config.dto';
import { DeviceConfigService } from './device-config.service';
import { DeviceSoftwareDto, DeviceComponentStateDto } from '@app/common/dto/device/dto/device-software.dto';
import { ReleaseChangedEventDto } from '@app/common/dto/upload';
import { Deprecated } from '@app/common/decorators';
import { RpcPayload } from '@app/common/microservice-client';
import * as fs from 'fs';

@Controller()
export class DeviceController {
  private readonly logger = new Logger(DeviceController.name);


  constructor(private readonly deviceService: DeviceService, private readonly configService: DeviceConfigService) { }

  @MessagePattern(DeviceTopics.REGISTER_SOFTWARE)
  registerSoftware(@RpcPayload() data: DeviceRegisterDto) {
    return this.deviceService.registerSoftware(data)
  }

  @MessagePattern(DeviceTopics.All_DEVICES)
  getRegisteredDevices(@RpcPayload('groups') groups: string[]): Promise<DeviceDto[]> {
    return this.deviceService.getRegisteredDevices(groups)
  }

  @MessagePattern(DeviceTopics.DEVICES_SOFTWARE_STATISTIC_INFO)
  getDevicesSoftwareStatisticInfo(@RpcPayload('params') params: { [key: string]: string[] }): Promise<DevicesStatisticInfo> {
    return this.deviceService.getDevicesSoftwareStatisticInfo(params)
  }
  
  @MessagePattern(DeviceTopics.DEVICES_MAP_STATISTIC_INFO)
  getDevicesMapStatisticInfo(@RpcPayload('params') params: { [key: string]: string[] }): Promise<DevicesStatisticInfo> {
    return this.deviceService.getDevicesMapStatisticInfo(params)
  }

  @MessagePattern(DeviceTopics.DEVICES_PUT)
  putDeviceProperties(@RpcPayload() p: DevicePutDto): Promise<DevicePutDto> {
    return this.deviceService.putDeviceProperties(p)
  }

  @MessagePattern(DeviceTopics.DEVICE_MAPS)
  getDeviceMaps(@RpcPayload("stringValue") deviceId: string): Promise<DeviceMapDto> {
    return this.deviceService.getDeviceMaps(deviceId)
  }

  @MessagePattern(DeviceTopics.DEVICE_SOFTWARES)
  getDeviceSoftwares(@RpcPayload("stringValue") deviceId: string): Promise<DeviceSoftwareDto> {
    return this.deviceService.getDeviceSoftwares(deviceId)
  }

  @MessagePattern(DeviceTopics.DEVICE_CONTENT)
  deviceInstalled(@RpcPayload("stringValue") deviceId: string): Promise<DeviceContentResDto> {
    return this.deviceService.deviceInstalled(deviceId)
  }

  @MessagePattern(DeviceTopics.All_MAPS)
  getRequestedMaps(): Promise<MapDto[]> {
    return this.deviceService.getRequestedMaps()
  }

  @MessagePattern(DeviceTopics.GET_MAP)
  mapById(@RpcPayload("stringValue") catalogId: string): Promise<MapDevicesDto> {
    return this.deviceService.mapById(catalogId)
  }

  @Deprecated()
  @EventPattern(DeviceTopicsEmit.REGISTER_MAP_TO_DEVICE)
  registerMapToDevice(@RpcPayload() mapData: RegisterMapDto) {
    this.deviceService.registerMapToDevice(mapData.map, mapData.deviceId);
  }

  @EventPattern(DeviceTopicsEmit.REGISTER_MAP_INVENTORY)
  registerMapInventoryToDevice(@RpcPayload() inventory: InventoryDeviceUpdatesDto) {
    this.deviceService.registerMapInventoryToDevice(inventory);
  }

  @EventPattern(DeviceTopicsEmit.UPDATE_DEVICE_MAP_STATE)
  updateDeviceMap(@RpcPayload() state: DeviceMapStateDto | DeviceMapStateDto[]) {
    this.deviceService.updateDeviceMap(state)
  }

  @EventPattern(DeviceTopicsEmit.UPDATE_DEVICE_SOFTWARE_STATE)
  updateDeviceSoftware(@RpcPayload() state: DeviceComponentStateDto | DeviceComponentStateDto[]) {
    this.deviceService.updateDeviceSoftware(state)
  }

  @EventPattern(DeviceTopicsEmit.RELEASE_CHANGED_EVENT)
  releaseChangedEvent(@RpcPayload() event: ReleaseChangedEventDto) {
    this.deviceService.releaseChangedEvent(event);
  }

  @MessagePattern(DeviceTopics.GET_DEVICE_CONFIG)
  getDeviceConfig(@RpcPayload("stringValue") group: string): Promise<WindowsConfigDto | AndroidConfigDto> {
    return this.configService.getDeviceConfig(group)
  }

  @MessagePattern(DeviceTopics.SET_DEVICE_CONFIG)
  setDeviceConfig(@RpcPayload() config: WindowsConfigDto | AndroidConfigDto): Promise<WindowsConfigDto | AndroidConfigDto> {
    return this.configService.setDeviceConfig(config)
  }

  @MessagePattern(DeviceTopics.CHECK_HEALTH)
  healthCheckSuccess() {
    const version = this.readImageVersion()
    this.logger.log(`Device service - Health checking, Version: ${version}`)
    return "Device service is running successfully. Version: " + version
  }

  private readImageVersion(){
    let version = 'unknown'
    try{
      version = fs.readFileSync('NEW_TAG.txt','utf8');
    }catch(error){
      this.logger.error(`Unable to read image version - error: ${error}`)
    }
    return version
  }
  
}
