import { Controller, Logger } from "@nestjs/common";
import { HierarchyService } from "./hierarchy.service";
import { DevicesHierarchyTopics } from "@app/common/microservice-client/topics";
import { CreateDeviceTypeDto, DeviceTypeParams, DeviceTypeDto, UpdateDeviceTypeDto, CreatePlatformDto, PlatformDto, PlatformParams, UpdatePlatformDto, PlatformDeviceTypeParams, DeviceTypeProjectParams, DeviceTypeHierarchyDto, PlatformHierarchyDto } from "@app/common/dto/devices-hierarchy";
import { RpcPayload } from "@app/common/microservice-client";
import { MessagePattern } from "@nestjs/microservices";
import { ValidateProjectUserAccess } from "@app/common/utils/project-access";


@Controller()
export class HierarchyController {
  private readonly logger = new Logger(HierarchyController.name);

  constructor(private readonly hierarchyService: HierarchyService) {}

  
  @MessagePattern(DevicesHierarchyTopics.CREATE_PLATFORM)
  createPlatform(@RpcPayload() dto: CreatePlatformDto) {
    return this.hierarchyService.createPlatform(dto);
  }

  @MessagePattern(DevicesHierarchyTopics.GET_PLATFORM_BY_NAME)
  getPlatform(@RpcPayload() params: PlatformParams) {
    return this.hierarchyService.getPlatform(params);
  }
  
  @MessagePattern(DevicesHierarchyTopics.GET_PLATFORMS)
  getPlatforms(@RpcPayload() query?: string): Promise<PlatformDto[]> {
    return this.hierarchyService.getPlatforms(query);
  }
  
  @MessagePattern(DevicesHierarchyTopics.UPDATE_PLATFORM)
  updatePlatform(@RpcPayload() dto: UpdatePlatformDto) {
    return this.hierarchyService.updatePlatform(dto);
  }
  
  @MessagePattern(DevicesHierarchyTopics.DELETE_PLATFORM)
  deletePlatform(@RpcPayload() params: PlatformParams) {
    return this.hierarchyService.deletePlatform(params);
  }

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

  @MessagePattern(DevicesHierarchyTopics.GET_PLATFORM_HIERARCHY_TREE)
  getPlatformHierarchy(@RpcPayload() params: PlatformParams): Promise<PlatformHierarchyDto> {
    return this.hierarchyService.getPlatformHierarchy(params);
  }

  @MessagePattern(DevicesHierarchyTopics.GET_DEVICE_TYPE_HIERARCHY_TREE)
  getDeviceTypeHierarchy(@RpcPayload() params: DeviceTypeParams): Promise<DeviceTypeHierarchyDto> {
    return this.hierarchyService.getDeviceTypeHierarchy(params);
  }

  @MessagePattern(DevicesHierarchyTopics.ADD_DEVICE_TYPE_TO_PLATFORM)
  addDeviceTypeToPlatform(@RpcPayload() params: PlatformDeviceTypeParams): Promise<PlatformHierarchyDto>{
    return this.hierarchyService.addDeviceTypeToPlatform(params);
  }

  @MessagePattern(DevicesHierarchyTopics.REMOVE_DEVICE_TYPE_FROM_PLATFORM)
  removeDeviceTypeFromPlatform(@RpcPayload() params: PlatformDeviceTypeParams): Promise<PlatformHierarchyDto>{
    return this.hierarchyService.removeDeviceTypeFromPlatform(params);
  }

  @ValidateProjectUserAccess()
  @MessagePattern(DevicesHierarchyTopics.ADD_PROJECT_TO_DEVICE_TYPE)
  addProjectToDeviceType(@RpcPayload() params: DeviceTypeProjectParams): Promise<DeviceTypeHierarchyDto> {
    return this.hierarchyService.addProjectToDeviceType(params);
  }

  @ValidateProjectUserAccess()
  @MessagePattern(DevicesHierarchyTopics.REMOVE_PROJECT_FROM_DEVICE_TYPE)
  removeProjectFromDeviceType(@RpcPayload() params: DeviceTypeProjectParams): Promise<DeviceTypeHierarchyDto> {
    return this.hierarchyService.removeProjectFromDeviceType(params);
  }
}