import { CreateDevicesGroupDto, EditDevicesGroupDto, SetDevicesInGroupDto } from "@app/common/dto/devices-group";
import { DevicesGroupTopics } from "@app/common/microservice-client/topics";
import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { GroupService } from "./group.service";

@Controller()
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @MessagePattern(DevicesGroupTopics.CREATE_GROUP)
  createGroup(group: CreateDevicesGroupDto){
    return this.groupService.createGroup(group);
  }

  @MessagePattern(DevicesGroupTopics.EDIT_GROUP)
  editGroup(group: EditDevicesGroupDto){
    return this.groupService.editGroup(group);
  }

  @MessagePattern(DevicesGroupTopics.GET_GROUPS)
  getGroups(){
    return this.groupService.getGroups();
  }

  @MessagePattern(DevicesGroupTopics.GET_GROUP_DEVICES)
  getGroupDevices(groupId: string){
    return this.groupService.getGroupDevices(groupId);
  }

  @MessagePattern(DevicesGroupTopics.SET_GROUP_DEVICES)
  setDevicesInGroup(devices: SetDevicesInGroupDto){
    return this.groupService.setDevicesInGroup(devices);
  }

}