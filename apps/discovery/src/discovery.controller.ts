import { DeviceTopics, DeviceTopicsEmit, DiscoveryTopics, GetMapTopics } from '@app/common/microservice-client/topics';
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { DiscoveryService } from './discovery.service';
import { DiscoveryMessageDto } from '@app/common/dto/discovery';
import { DeviceRegisterDto, MTlsStatusDto } from '@app/common/dto/device';
import { DeviceContentResDto } from '@app/common/dto/device';
import { DeviceDiscoverDto, DeviceDiscoverResDto } from '@app/common/dto/im';
import { MapDevicesDto } from '@app/common/dto/map/dto/all-maps.dto';
import { MapDto } from '@app/common/dto/map';
import { DeviceDto } from '@app/common/dto/device/dto/device.dto';

@Controller()
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @MessagePattern(DeviceTopics.DISCOVERY_SOFTWARE)
  discoveryMessage(@Payload() data: DiscoveryMessageDto){
    this.discoveryService.discoveryMessage(data)
    return this.discoveryService.checkUpdates(data)
  }

  @MessagePattern(DeviceTopics.REGISTER_SOFTWARE)
  registerSoftware(@Payload() data: DeviceRegisterDto){
    return this.discoveryService.registerSoftware(data)
  }

  @MessagePattern(DeviceTopics.All_DEVICES)
  getRegisteredDevices(): Promise<DeviceDto[]>{
    return this.discoveryService.getRegisteredDevices()
  }

  @MessagePattern(DeviceTopics.DEVICE_CONTENT)
  deviceInstalled(@Payload() deviceId: string): Promise<DeviceContentResDto>{
    return this.discoveryService.deviceInstalled(deviceId)
  }
  
  @MessagePattern(DeviceTopics.All_MAPS)
  getRequestedMaps(): Promise<MapDto[]>{
    return this.discoveryService.getRequestedMaps()
  }
  
  @MessagePattern(DeviceTopics.GET_MAP)
  mapById(@Payload() catalogId: string): Promise<MapDevicesDto>{
    return this.discoveryService.mapById(catalogId)
  }

  @EventPattern(DeviceTopicsEmit.SAVE_MAP_DATA)
  saveMapData(mapData: any){
    this.discoveryService.saveMapData(mapData);
  }

  @EventPattern(DeviceTopicsEmit.IM_PUSH_DISCOVERY)
  imPushDiscoveryDevices(@Payload() devicesDiscovery: DeviceDiscoverDto[]){
    this.discoveryService.imPushDiscoveryDevices(devicesDiscovery);

  }
 
  @MessagePattern(DeviceTopics.IM_PULL_DISCOVERY)
  imPullDiscoveryDevices(@Payload() devicesDiscovery: DeviceDiscoverDto[]): Promise<DeviceDiscoverResDto[]>{
    return this.discoveryService.imPullDiscoveryDevices(devicesDiscovery)
  }
  
  @EventPattern(DeviceTopicsEmit.UPDATE_TLS_STATUS)
  updateMTlsStatus(@Payload() mTlsStatus: MTlsStatusDto){
    this.discoveryService.updateMTlsStatusForDevice(mTlsStatus);
  }
}
