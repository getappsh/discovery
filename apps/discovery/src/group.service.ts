import { DeviceEntity, DevicesGroupEntity } from "@app/common/database/entities";
import { CreateDevicesGroupDto, DevicesGroupDto, EditDevicesGroupDto, SetDevicesInGroupDto } from "@app/common/dto/devices-group";
import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectRepository(DevicesGroupEntity) private readonly groupRepo: Repository<DevicesGroupEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,

  ) { }

  async createGroup(group: CreateDevicesGroupDto) {
    this.logger.log(`Create a new Group ${JSON.stringify(group)}`)
    let saveGroup = this.groupRepo.create();
    saveGroup.name = group.name;
    saveGroup.description = group.description;

    try {
      let newGroup = await this.groupRepo.save(saveGroup);
      return DevicesGroupDto.fromDevicesGroupEntity(newGroup);
    } catch (error) {
      this.logger.error(`Failed to save the new Group ${error}`);
      throw new Error(`Failed to save the new Group ${error}`)
    }

  }

  async editGroup(group: EditDevicesGroupDto) {
    this.logger.log(`Edit the Group ${JSON.stringify(group)}`)
    let savedGroup = await this.groupRepo.findOneBy({ id: group.id });

    try {
      let newGroup = await this.groupRepo.save({ ...savedGroup, ...group });
      return DevicesGroupDto.fromDevicesGroupEntity(newGroup);
    } catch (error) {
      this.logger.error(`Failed to edit the Group ${error}`);
      throw new Error(`Failed to edit the  Group ${error}`)
    }

  }

  async getGroups() {
    this.logger.log(`Get Groups`)
    let groups = await this.groupRepo.find({ take: 100 })
    this.logger.debug(`Fonded ${JSON.stringify(groups)} groups`)

    return groups.map(g => DevicesGroupDto.fromDevicesGroupEntity(g))
  }

  async getGroupDevices(groupId: string) {
    // TODO

    // this.logger.log(`Get Group devices ${groupId}`)
    // let group = await this.groupRepo.findOne({where: {id: parseInt(groupId)}, relations: ["devices"]})
    // return DevicesGroupDto.fromDevicesGroupEntity(group)

    return
  }

  async setDevicesInGroup(group: SetDevicesInGroupDto) {
    this.logger.log(`Set devices in group: ${JSON.stringify(group)}`)
    let groupEntity = await this.groupRepo.findOneBy({ id: group.id })
    this.logger.debug(`founded group ${JSON.stringify(groupEntity)}`)
    if (group.devices) {
      groupEntity.devices = group.devices.map(dev_id => ({ ID: dev_id } as DeviceEntity));
    }
    if (group.groups) {
      groupEntity.children = group.groups.map(g_id => ({ id: parseInt(g_id) } as DevicesGroupEntity));
    }
    this.logger.debug(`group to save ${JSON.stringify(groupEntity)}`)

    let res = await this.groupRepo.save(groupEntity);
    this.logger.debug(JSON.stringify(res))
    return DevicesGroupDto.fromDevicesGroupEntity(res)
  }

}