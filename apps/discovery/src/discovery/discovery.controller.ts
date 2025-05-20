import { DeviceTopics, DeviceTopicsEmit } from '@app/common/microservice-client/topics';
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { DiscoveryService } from './discovery.service';
import { DiscoveryMessageDto, DiscoveryMessageV2Dto } from '@app/common/dto/discovery';
import { MTlsStatusDto } from '@app/common/dto/device';
import { DeviceDiscoverDto, DeviceDiscoverResDto } from '@app/common/dto/im';
import { RpcPayload } from '@app/common/microservice-client';

@Controller()
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @MessagePattern(DeviceTopics.DEVICE_PERSONAL)
  getDevicePersonName(@RpcPayload() deviceID: string){    
   return this.discoveryService.getDevicePerson(deviceID)
  }

  @EventPattern(DeviceTopicsEmit.DISCOVER_DEVICE_CONTEXT)
  discoveryDeviceContext(@RpcPayload() data: DiscoveryMessageDto){
    this.discoveryService.discoveryMessage(data)
  }

  @EventPattern(DeviceTopicsEmit.DISCOVER_DEVICE_CONTEXT_V2)
  discoverDeviceContextV2(@RpcPayload() dto: DiscoveryMessageV2Dto){
    this.discoveryService.discoveryDeviceContext(dto);
  }
  
  @EventPattern(DeviceTopicsEmit.IM_PUSH_DISCOVERY)
  imPushDiscoveryDevices(@RpcPayload() devicesDiscovery: DeviceDiscoverDto[]){
    this.discoveryService.imPushDiscoveryDevices(devicesDiscovery);

  }
 
  @MessagePattern(DeviceTopics.IM_PULL_DISCOVERY)
  imPullDiscoveryDevices(@RpcPayload() devicesDiscovery: DeviceDiscoverDto[]): Promise<DeviceDiscoverResDto[]>{
    return this.discoveryService.imPullDiscoveryDevices(devicesDiscovery)
  }
  
  @EventPattern(DeviceTopicsEmit.UPDATE_TLS_STATUS)
  updateMTlsStatus(@RpcPayload() mTlsStatus: MTlsStatusDto){
    this.discoveryService.updateMTlsStatusForDevice(mTlsStatus);
  }
}
