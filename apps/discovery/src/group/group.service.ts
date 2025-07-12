import { DeviceEntity, OrgGroupEntity, OrgUIDEntity } from "@app/common/database/entities";
import { CreateDevicesGroupDto, ChildGroupDto, EditDevicesGroupDto, SetChildInGroupDto, ChildGroupRawDto, GroupResponseDto } from "@app/common/dto/devices-group";
import { Injectable, Logger, InternalServerErrorException, ConflictException, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Not, QueryFailedError, Repository } from "typeorm";
import { DeviceRepoService } from "../modules/device-client-repo/device-repo.service";
import { AppError, ErrorCode } from "@app/common/dto/error";
import { OrgIdDto, OrgIdPutDto, OrgIdRefDto } from "@app/common/dto/devices-group/dto/org-id.dto";
import { DeviceOrgDto } from "@app/common/dto/device/dto/device-org.dto";

@Injectable()
export class GroupService {

  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectRepository(OrgGroupEntity) private readonly groupRepo: Repository<OrgGroupEntity>,
    @InjectRepository(OrgUIDEntity) private readonly orgUidRepo: Repository<OrgUIDEntity>,
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
      if (!obj.parent) {
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

    if ('parent' in group) {
      if (group.parent === null) {
        (groupEntity.parent as any) = null;
      } else {
        const parentGroup = await this.groupRepo.findOneBy({ id: group.parent });
        (groupEntity.parent as any) = parentGroup;
      }
      await this.groupRepo.save(groupEntity);
    }

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

      await this.orgUidRepo.save(uids);
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

  async deleteGroup(groupId: string) {
    this.logger.log(`Delete group with id: ${groupId}`);
    const group = await this.groupRepo.findOneBy({ id: parseInt(groupId) });
    if (!group) {
      throw new AppError(ErrorCode.GROUP_NOT_FOUND, `Group with id ${groupId} not found`);
    }
    const removedGroup = await this.groupRepo.remove(group);
    return ChildGroupDto.fromDevicesGroupEntity(removedGroup);
  }

  async getOrgDeviceData(deviceId: string) {
    this.logger.log(`Get device details for device ID: '${deviceId}'`);

    const device = await this.buildDeviceOrgQuery(deviceId).getOne();


    if (device) {
      return device;
    } else {
      this.logger.error(`Device with ID ${deviceId} not found`);
      throw new AppError(ErrorCode.DEVICE_NOT_FOUND, `Device with ID ${deviceId} not found`, HttpStatus.BAD_REQUEST);
    }
  }

  async getOrgDevicesData() {
    this.logger.log(`Get all devices with org data`);

    const devices = await this.buildDeviceOrgQuery()
    .orderBy("device.createdDate", "DESC")
    .getMany();

    return devices.map(device => DeviceOrgDto.fromDeviceEntity(device));
  }

  async createOrgIds(orgIds: OrgIdDto) {
    this.logger.log(`Create orgIds: ${JSON.stringify(orgIds)}`);
    let orgIdsEntity = this.orgUidRepo.create({ UID: orgIds.orgId });
    try {
      orgIdsEntity = await this.orgUidRepo.save(orgIdsEntity);
      return OrgIdRefDto.fromOrgIdEntity(orgIdsEntity);
    } catch (error: any) {
      this.logger.error(`Failed to save organization IDs: ${error}`);

      // Handle known DB error codes (e.g., PostgreSQL unique violation: 23505)
      if (error instanceof QueryFailedError) {
        const err = error as any;

        if (err.code === '23505') {
          // Unique constraint violation
          throw new AppError(ErrorCode.GROUP_ORG_ID_CONFLICT, `Organization ID ${orgIds.orgId} already exists.`, HttpStatus.CONFLICT);
        }
      }
      throw new AppError(ErrorCode.GROUP_ORG_ID_UNKNOWN, `Failed to save organization IDs.`);
    }
  }

  private buildBaseOrgIdQuery() {
    return this.orgUidRepo.createQueryBuilder("org")
      .leftJoin("org.device", "device")
      .leftJoin("org.group", "group")
      .select([
        "org.UID as orgId",
        "device.ID as deviceId",
        "group.id as groupId"
      ]);
  }

  async getOrgIds(group?: number, emptyGroup?: boolean, emptyDevice?: boolean): Promise<OrgIdRefDto[]> {
    this.logger.log(`Get orgIds for group: ${group}, emptyGroup: ${emptyGroup}, emptyDevice: ${emptyDevice}`);

    const query = this.buildBaseOrgIdQuery();

    if (group !== null && group !== undefined && emptyGroup) {
      query.where("(group.id = :group OR group.id IS NULL)", { group });
    } else if (group !== null && group !== undefined) {
      query.where("group.id = :group", { group });
    } else if (emptyGroup) {
      query.where("group.id IS NULL");
    }

    if (emptyDevice) {
      query.andWhere("device.ID IS NULL");
    }

    try {
      const result = await query.getRawMany();
      return result.map(row => OrgIdRefDto.fromRaw(row));

    } catch (error) {
      this.logger.error(`Failed to get orgIds: ${error}`);
      throw new AppError(ErrorCode.GROUP_ORG_ID_UNKNOWN, error.message);
    }

  }


  async getOrgId(orgId: number) {
    this.logger.log(`Get orgId: ${orgId}`);
    try {

      const raw = await this.buildBaseOrgIdQuery()
        .where("org.UID = :orgId", { orgId })
        .getRawOne();

      if (!raw) {
        throw new AppError(
          ErrorCode.GROUP_ORG_ID_NOT_FOUND,
          `Organization ID ${orgId} not found.`,
          HttpStatus.NOT_FOUND
        );
      }

      return OrgIdRefDto.fromRaw(raw);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error(`Failed to get organization ID ${orgId}: ${error}`);
      throw new AppError(ErrorCode.GROUP_ORG_ID_UNKNOWN, error.message);
    }
  }

  async editOrgIds(payload: OrgIdPutDto) {
    // Basic implementation: edit orgId
    this.logger.log(`Edit orgId: ${payload.orgId}, data: ${JSON.stringify(payload)}`);


    try {
      const orgEntity = await this.orgUidRepo.findOne({ where: { UID: payload.orgId }, relations: ["device", "group"] });

      if (!orgEntity) {
        throw new AppError(
          ErrorCode.GROUP_ORG_ID_NOT_FOUND,
          `Organization ID ${payload.orgId} not found.`,
          HttpStatus.NOT_FOUND
        );
      }

      // Update device relation
      if ("device" in payload) {
        if (payload.device === null) {
          orgEntity.device = null;
        } else if (payload.device) {
          const deviceEntity = await this.deviceRepo.findOne({ where: { ID: payload.device } });
          if (!deviceEntity) {
            throw new AppError(
              ErrorCode.DEVICE_NOT_FOUND,
              `Device ID ${payload.device} not found.`,
              HttpStatus.BAD_REQUEST
            );
          }

          if (orgEntity.device && orgEntity.device.ID !== payload.device) {
            const msg = `Org Id Device is already associated to another device. Reassigning to a new device (ID ${payload.device}) is not allowed.`;
            this.logger.error(msg);
            throw new AppError(
              ErrorCode.GROUP_ORG_ID_CONFLICT,
              msg,
              HttpStatus.CONFLICT
            );
          }
          orgEntity.device = deviceEntity;
        }
      }

      // Update group relation
      if ("group" in payload) {
        if (payload.group === null) {
          orgEntity.group = null;
        } else {
          const groupEntity = await this.groupRepo.findOne({ where: { id: payload.group } });
          if (!groupEntity) {
            throw new AppError(
              ErrorCode.GROUP_NOT_FOUND,
              `Group ID ${payload.group} not found.`,
              HttpStatus.BAD_REQUEST
            );
          }

          // Optional strict rule: disallow changing group if already set to another one
          if (orgEntity.group && orgEntity.group.id !== payload.group) {
            const msg = `OrgId is already linked to group ${orgEntity.group.id}. Reassigning to group ${payload.group} is not allowed.`;
            this.logger.error(msg);
            throw new AppError(
              ErrorCode.GROUP_ORG_ID_CONFLICT,
              msg,
              HttpStatus.CONFLICT
            );
          }

          orgEntity.group = groupEntity;
        }
      }

      const savedEntity = await this.orgUidRepo.save(orgEntity);

      return OrgIdRefDto.fromOrgIdEntity(savedEntity);
    } catch (error) {
      this.logger.error(`Failed to edit orgId ${payload.orgId}: ${error}`);

      if (error instanceof AppError) throw error;

      throw new AppError(
        ErrorCode.GROUP_ORG_ID_UNKNOWN,
        `Failed to edit organization ID.`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async deleteOrgIds(orgId: number) {
    this.logger.log(`Delete orgId: ${orgId}`);

    try {
      const deleteE = await this.orgUidRepo.findOne({ where: { UID: orgId } });
      const deleteResult = await this.orgUidRepo.delete({ UID: orgId });

      if (deleteResult.affected === 0) {
        throw new AppError(
          ErrorCode.GROUP_ORG_ID_NOT_FOUND,
          `Organization ID ${orgId} not found.`,
          HttpStatus.NOT_FOUND
        );
      }

      return deleteE && OrgIdRefDto.fromOrgIdEntity(deleteE);
    } catch (error: any) {
      this.logger.error(`Failed to delete orgId ${orgId}: ${error}`);

      if (error instanceof AppError) throw error;

      throw new AppError(
        ErrorCode.GROUP_ORG_ID_UNKNOWN,
        `Failed to delete organization ID.`
      );
    }
  }

  private buildDeviceOrgQuery(deviceId?: string) {
    const query = this.deviceRepo.createQueryBuilder('device')
      .leftJoinAndSelect('device.parent', 'parent')
      .leftJoinAndSelect('device.orgUID', 'org')
      .leftJoinAndSelect('org.group', 'group')
      .leftJoinAndSelect('device.platform', 'platform')
      .leftJoinAndSelect('device.deviceType', 'deviceType')
      .leftJoinAndSelect('device.children', 'children')
      .select([
        'device',
        'parent.ID',
        'children.ID',
        'org.UID',
        'group.id',
        'group.name',
        'platform.name',
        'platform.id',
        'deviceType.name',
        'deviceType.id'
      ]);
    if (deviceId) {
      query.where('device.ID = :deviceId', { deviceId });
    }
    return query;
  }
}