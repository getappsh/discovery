import { DeviceTopics, DeviceTopicsEmit } from '@app/common/microservice-client/topics';
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { DeviceMapDto, DeviceRegisterDto } from '@app/common/dto/device';
import { DeviceContentResDto } from '@app/common/dto/device';
import { MapDevicesDto } from '@app/common/dto/map/dto/all-maps.dto';
import { MapDto } from '@app/common/dto/map';
import { DeviceDto } from '@app/common/dto/device/dto/device.dto';
import { DeviceService } from './device.service';
import { RegisterMapDto } from '@app/common/dto/device/dto/register-map.dto';
import { InventoryDeviceUpdatesDto } from '@app/common/dto/map/dto/inventory-device-updates-dto';
import { DevicePutDto } from '@app/common/dto/device/dto/device-put.dto';

@Controller()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @MessagePattern(DeviceTopics.REGISTER_SOFTWARE)
  registerSoftware(@Payload() data: DeviceRegisterDto){
    return this.deviceService.registerSoftware(data)
  }

  @MessagePattern(DeviceTopics.All_DEVICES)
  getRegisteredDevices(): Promise<DeviceDto[]>{
    return this.deviceService.getRegisteredDevices()
  }
  
  @MessagePattern(DeviceTopics.DEVICES_PUT)
  putDeviceProperties(@Payload() p: DevicePutDto): Promise<DevicePutDto>{
    return this.deviceService.putDeviceProperties(p)
  }
  
  @MessagePattern(DeviceTopics.DEVICE_MAPS)
  getDeviceMaps(@Payload("stringValue") deviceId: string): Promise<DeviceMapDto>{
    return this.deviceService.getDeviceMaps(deviceId)
  }

  @MessagePattern(DeviceTopics.DEVICE_CONTENT)
  deviceInstalled(@Payload("stringValue") deviceId: string): Promise<DeviceContentResDto>{
    return this.deviceService.deviceInstalled(deviceId)
  }
  
  @MessagePattern(DeviceTopics.All_MAPS)
  getRequestedMaps(): Promise<MapDto[]>{
    return this.deviceService.getRequestedMaps()
  }
  
  @MessagePattern(DeviceTopics.GET_MAP)
  mapById(@Payload("stringValue") catalogId: string): Promise<MapDevicesDto>{
    return this.deviceService.mapById(catalogId)
  }

  @EventPattern(DeviceTopicsEmit.REGISTER_MAP_TO_DEVICE)
  registerMapToDevice(mapData: RegisterMapDto){
    this.deviceService.registerMapToDevice(mapData.map, mapData.deviceId);
  }
 
  @EventPattern(DeviceTopicsEmit.REGISTER_MAP_INVENTORY)
  registerMapInventoryToDevice(inventory: InventoryDeviceUpdatesDto){
    this.deviceService.registerMapInventoryToDevice(inventory);
  }

  @MessagePattern(DeviceTopics.CHECK_HEALTH)
  healthCheckSuccess(){
    return "Device service is success"
  }
  
}
