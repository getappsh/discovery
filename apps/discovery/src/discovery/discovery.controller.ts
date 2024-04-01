import { DeviceTopics, DeviceTopicsEmit } from '@app/common/microservice-client/topics';
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { DiscoveryService } from './discovery.service';
import { DiscoveryMessageDto } from '@app/common/dto/discovery';
import { MTlsStatusDto } from '@app/common/dto/device';
import { DeviceDiscoverDto, DeviceDiscoverResDto } from '@app/common/dto/im';

@Controller()
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @MessagePattern(DeviceTopics.DISCOVERY_SOFTWARE)
  discoveryMessage(@Payload() data: DiscoveryMessageDto){
    this.discoveryService.discoveryMessage(data)
    return this.discoveryService.checkUpdates(data)
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
