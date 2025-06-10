import { Controller, Logger } from "@nestjs/common";
import { HierarchyService } from "./hierarchy.service";
import { DevicesHierarchyTopics } from "@app/common/microservice-client/topics";
import { CreateDeviceTypeDto, DeviceTypeParams, DeviceTypeDto, UpdateDeviceTypeDto } from "@app/common/dto/devices-hierarchy";
import { RpcPayload } from "@app/common/microservice-client";
import { MessagePattern } from "@nestjs/microservices";


@Controller()
export class HierarchyController {
  private readonly logger = new Logger(HierarchyController.name);

  constructor(private readonly hierarchyService: HierarchyService) {}



  @MessagePattern(DevicesHierarchyTopics.CREATE_DEVICE_TYPE)
  createDeviceType(@RpcPayload() dto: CreateDeviceTypeDto) {
    return this.hierarchyService.createDeviceType(dto);
  }

  @MessagePattern(DevicesHierarchyTopics.GET_DEVICE_TYPE_BY_NAME)
  getDeviceType(@RpcPayload() params: DeviceTypeParams) {
    return this.hierarchyService.getDeviceType(params);
  }

  @MessagePattern(DevicesHierarchyTopics.GET_DEVICE_TYPES)
  getDeviceTypes(@RpcPayload() query?: string): Promise<DeviceTypeDto[]> {
    return this.hierarchyService.getDeviceTypes(query);
  }

  @MessagePattern(DevicesHierarchyTopics.UPDATE_DEVICE_TYPE)
  updateDeviceType(@RpcPayload() dto: UpdateDeviceTypeDto) {
    return this.hierarchyService.updateDeviceType(dto);
  }

  @MessagePattern(DevicesHierarchyTopics.DELETE_DEVICE_TYPE)
  deleteDeviceType(@RpcPayload() params: DeviceTypeParams) {
    return this.hierarchyService.deleteDeviceType(params);
  }
  

}