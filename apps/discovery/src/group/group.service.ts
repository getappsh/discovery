import { DeviceEntity, OrgGroupEntity, OrgUIDEntity } from "@app/common/database/entities";
import { CreateDevicesGroupDto, ChildGroupDto, EditDevicesGroupDto, SetChildInGroupDto, ChildGroupRawDto, GroupResponseDto } from "@app/common/dto/devices-group";
import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Not, Repository } from "typeorm";
import { DeviceRepoService } from "../modules/device-client-repo/device-repo.service";
import { AppError, ErrorCode } from "@app/common/dto/error";

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectRepository(OrgGroupEntity) private readonly groupRepo: Repository<OrgGroupEntity>,
    @InjectRepository(OrgUIDEntity) private readonly orgUid: Repository<OrgUIDEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    private deviceRepoS: DeviceRepoService
  ) { }

  async createGroup(group: CreateDevicesGroupDto) {
    this.logger.log(`Create a new Group ${JSON.stringify(group)}`)
    let saveGroup = this.groupRepo.create();
    saveGroup.name = group.name;
    saveGroup.description = group.description;

    try {
      let newGroup = await this.groupRepo.save(saveGroup);
      return ChildGroupDto.fromDevicesGroupEntity(newGroup);
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
      return ChildGroupDto.fromDevicesGroupEntity(newGroup);
    } catch (error) {
      this.logger.error(`Failed to edit the Group ${error}`);
      throw new Error(`Failed to edit the  Group ${error}`)
    }

  }

  async getGroups(id?: number | number[]): Promise<ChildGroupDto | GroupResponseDto> {
    this.logger.log(`Get ${id ? "groups with id " + id : "all groups"}`)

    const query = this.groupRepo.createQueryBuilder("group")
      .leftJoin("group.children", "child")
      .leftJoin("group.orgUID", "org")
      .select([
        "group", // Select all fields from the group
      ])
      .addSelect("array_agg(DISTINCT child.id) FILTER (WHERE child.id IS NOT NULL)", "childrenIds")
      // .addSelect("array_agg(DISTINCT org.device_id) FILTER (WHERE org.device_id IS NOT NULL)", "deviceIds")
      .groupBy("group.id") // Group by group and orgUID fields
      .take(100)

    if (id) {
      const numIds = Array.isArray(id) ? id : [id]
      query
        .addSelect("array_agg(DISTINCT org.device_id) FILTER (WHERE org.device_id IS NOT NULL)", "deviceIds")
        .where("group.id IN (:...numIds)", { numIds });
    }

    const groups = await query
      .getRawMany() as ChildGroupRawDto[];

    this.logger.debug(`Fonded ${JSON.stringify(groups)} groups`)

    if (id && groups && groups.length && groups.length > 0) {
      return ChildGroupDto.fromChildGroupRawDto(groups[0])
    }
    let groupsDto = groups.map(g => ChildGroupDto.fromChildGroupRawDto(g))

    let groupsObj: GroupResponseDto = { roots: [], groups: {} }
    groupsObj.groups = groupsDto.reduce((acc, obj) => {
      if (obj.parent === null) {
        groupsObj.roots.push(obj.id.toString())
      }
      acc[obj.id] = obj;
      return acc;
    }, {} as Record<number, ChildGroupDto>);

    return groupsObj
  }

  async getGroupDevices(groupId: string) {
    // TODO

    // this.logger.log(`Get Group devices ${groupId}`)
    // let group = await this.groupRepo.findOne({where: {id: parseInt(groupId)}, relations: ["devices"]})
    // return DevicesGroupDto.fromDevicesGroupEntity(group)

    return
  }

  async setDevicesInGroup(group: SetChildInGroupDto) {
    this.logger.log(`Set devices in group: ${JSON.stringify(group)}`)
    let groupEntity = await this.groupRepo.findOneBy({ id: group.id })
    this.logger.debug(`found group ${JSON.stringify(groupEntity)}`)

    if (!groupEntity) throw new AppError(ErrorCode.GROUP_NOT_FOUND);

    if (group.devices) {
      const dvcWithDvcParent = await this.deviceRepo.find({ where: { ID: In(group.devices), parent: Not(IsNull()) } })
      if (dvcWithDvcParent.length > 0) {
        const msg = `Devices [${dvcWithDvcParent.map(d => d.ID).join(", ")}] are not allowed to be added to a group, because they are related to another device (have a parent device).`;
        this.logger.error(msg);
        throw new AppError(ErrorCode.GROUP_NOT_ALLOWED_TO_ADD, msg);
      }

      // TODO if device don't have a OrgUID number
      const uids = (await this.deviceRepoS.getDeviceOrgId(group.devices)).map(uid => {
        uid.group = groupEntity!
        return uid
      })

      const uidDeviceIds = uids.map(u => u.device?.ID);
      const missingDevices = group.devices.filter(d => !uidDeviceIds.includes(d));
      if (missingDevices.length > 0) {
        const errorMsg = `Devices [${missingDevices.join(", ")}] are not found in the organization UID list.`;
        this.logger.error(errorMsg);
        throw new AppError(ErrorCode.GROUP_NOT_ALLOWED_TO_ADD, errorMsg);
      }

      await this.orgUid.save(uids);
    }

    if (group.groups) {
      // TODO validate that the child group isn't one of its parents or grandparents 
      const groups = (await this.getGroupEntityById(group.groups)).map(g => {
        g.parent = groupEntity!
        return g
      })
      await this.groupRepo.save(groups)
    }
    this.logger.debug(`group to save ${JSON.stringify(groupEntity)}`)

    let res = await this.groupRepo.save(groupEntity);

    this.logger.debug(JSON.stringify(res))
    return ChildGroupDto.fromDevicesGroupEntity(res)

  }

  async getGroupEntityById(group: number | number[]): Promise<OrgGroupEntity[]> {
    this.logger.log(`Get organization id for the given devices`);

    const groups = Array.isArray(group) ? group : [group]
    const groupEntities = await this.groupRepo.find({ where: { id: In(groups) } })
    return groupEntities
  }

}