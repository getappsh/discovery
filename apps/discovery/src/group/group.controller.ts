import { CreateDevicesGroupDto, EditDevicesGroupDto, SetChildInGroupDto } from "@app/common/dto/devices-group";
import { DevicesGroupTopics } from "@app/common/microservice-client/topics";
import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { GroupService } from "./group.service";
import { RpcPayload } from "@app/common/microservice-client";
import { OrgIdPutDto } from "@app/common/dto/devices-group/dto/org-id.dto";

@Controller()
export class GroupController {
  constructor(private readonly groupService: GroupService) { }

  @MessagePattern(DevicesGroupTopics.CREATE_GROUP)
  createGroup(@RpcPayload() group: CreateDevicesGroupDto) {
    return this.groupService.createGroup(group);
  }

  @MessagePattern(DevicesGroupTopics.EDIT_GROUP)
  editGroup(@RpcPayload() group: EditDevicesGroupDto) {
    return this.groupService.editGroup(group);
  }

  @MessagePattern(DevicesGroupTopics.GET_GROUPS)
  getGroups(@RpcPayload() groupId?: any) {       
    return this.groupService.getGroups(groupId);
  }

  @MessagePattern(DevicesGroupTopics.GET_GROUP_DEVICES)
  getGroupDevices(@RpcPayload() groupId: string) {
    return this.groupService.getGroupDevices(groupId);
  }

  @MessagePattern(DevicesGroupTopics.SET_GROUP_DEVICES)
  setDevicesInGroup(@RpcPayload() devices: SetChildInGroupDto) {
    return this.groupService.setDevicesInGroup(devices);
  }

  @MessagePattern(DevicesGroupTopics.DELETE_GROUP)
  deleteGroup(@RpcPayload() groupId: string) {
    return this.groupService.deleteGroup(groupId);
  }

  @MessagePattern(DevicesGroupTopics.GET_ORG_DEVICES)
  getOrgDevicesData() {
    return this.groupService.getOrgDevicesData();
  }

  @MessagePattern(DevicesGroupTopics.CREATE_ORG_IDS)
  createOrgIds(@RpcPayload() orgIds: any) {
    return this.groupService.createOrgIds(orgIds);
  }

  @MessagePattern(DevicesGroupTopics.GET_ORG_IDS)
  getOrgIds(@RpcPayload() payload: { group?: number, emptyGroup?: boolean, emptyDevice?: boolean }) {
    return this.groupService.getOrgIds(payload.group, payload.emptyGroup, payload.emptyDevice);
  }

  @MessagePattern(DevicesGroupTopics.GET_ORG_ID)
  getOrgId(@RpcPayload() orgId: number) {
    return this.groupService.getOrgId(orgId);
  }

  @MessagePattern(DevicesGroupTopics.EDIT_ORG_IDS)
  editOrgIds(@RpcPayload() payload: OrgIdPutDto) {
    return this.groupService.editOrgIds(payload);
  }

  @MessagePattern(DevicesGroupTopics.DELETE_ORG_IDS)
  deleteOrgIds(@RpcPayload() orgId: number) {
    return this.groupService.deleteOrgIds(orgId);
  }

}