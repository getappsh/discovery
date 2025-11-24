import { DeviceEntity, MapEntity, DeviceMapStateEntity, OrgGroupEntity } from "@app/common/database/entities";
import { OrgUIDEntity } from "@app/common/database/entities/org-uid.entity";
import { DevicePutDto } from "@app/common/dto/device/dto/device-put.dto";
import { AppError, ErrorCode } from "@app/common/dto/error";
import { BadRequestException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository, EntityManager } from "typeorm";
import { DataSource } from "typeorm";


@Injectable()
export class DeviceRepoService {

  private readonly logger = new Logger(DeviceRepoService.name)

  constructor(
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(OrgUIDEntity) private readonly orgIdEntity: Repository<OrgUIDEntity>,
    private readonly dataSource: DataSource,
  ) { }

  async getOrCreateDevice(deviceId: string): Promise<DeviceEntity> {
    this.logger.log(`Find device ${deviceId} `)
    let device = await this.deviceRepo.findOne({ where: { ID: deviceId } })

    if (!device) {
      this.logger.log(`Device ${deviceId} not exist create him `)
      const newDevice = this.deviceRepo.create()
      newDevice.ID = deviceId
      device = await this.deviceRepo.save(newDevice)
    }

    return device
  }

  async getDeviceOrgId(device: string | string[]): Promise<OrgUIDEntity[]> {
    this.logger.log(`Get organization id for the given devices`);

    const devices = Array.isArray(device) ? device : [device]
    const dvcOrgIds = await this.orgIdEntity.find({
      where: { device: { ID: In(devices) } },
      relations: { device: true },
      select: {
        id: true,
        UID: true,
        device: { ID: true, name: true }
      }
    })
    return dvcOrgIds
  }

  async updateDeviceOrgUID(
    manager: EntityManager,
    dto: DevicePutDto,
    device: DeviceEntity
  ): Promise<OrgUIDEntity | null> {
    this.logger.log(`Updating device orgUID for device ${device.ID}`);
    let orgId: OrgUIDEntity | null = null;

    if (dto.orgUID != null) {
      orgId = await manager.findOne(OrgUIDEntity, {
        where: { UID: dto.orgUID },
        relations: ["device"],
      });

      if (orgId && orgId.device && orgId.device.ID !== device.ID) {
        throw new AppError(
          ErrorCode.GROUP_ORG_ID_CONFLICT,
          `orgUID ${dto.orgUID} is already assigned to another device`,
          HttpStatus.CONFLICT
        );
      }

      const existingOrgId = await manager.findOne(OrgUIDEntity, {
        where: { device: { ID: device.ID } }
      });

      if (existingOrgId) {
        existingOrgId.device = null;
        this.logger.verbose(`Remove old orgUID from device '${device.ID}'`);
        await manager.save(existingOrgId);
      }

      this.logger.verbose(`Assign device '${device.ID}' to orgUID '${dto.orgUID}'`);
      if (orgId) {
        orgId.device = device;
      } else {
        orgId = manager.create(OrgUIDEntity, {
          UID: dto.orgUID,
          device: device
        });
      }
    } else {
      // Remove association
      orgId = await manager.findOne(OrgUIDEntity, {
        where: { device: { ID: device.ID } }
      });
      if (orgId) {
        this.logger.verbose(`Removing orgUID '${orgId.UID}' from device '${device.ID}'`);
        orgId.device = null;
      }
    }

    if (orgId) {
      return await manager.save(orgId);
    }

    return null;
  }


  async setDevice(dto: DevicePutDto) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const device = await queryRunner.manager.findOne(DeviceEntity, { where: { ID: dto.deviceId } });

      if (!device) {
        throw new BadRequestException(`Device ${dto.deviceId} does not exist`);
      }

      device.lastConnectionDate = new Date();

      if (dto.name !== undefined) {
        this.logger.verbose(`Updating device name to ${dto.name}`);
        device.name = dto.name;
      }

      let savedDevice = await queryRunner.manager.save(device);

      if ("orgUID" in dto) {
        const savedOrgId = await this.updateDeviceOrgUID(queryRunner.manager, dto, device);
        if (savedOrgId) {
          savedDevice.orgUID = savedOrgId;
        }
      }

      if ("groupId" in dto) {
        const existingOrgId = await queryRunner.manager.findOne(OrgUIDEntity, {
          where: { device: { ID: device.ID } }
        });

        if (!existingOrgId) {
          const msg = `Device ${device.ID} does not have an orgUID assigned. Please assign an orgUID before setting a group.`;
          this.logger.error(msg);
          throw new AppError(ErrorCode.GROUP_ORG_ID_NOT_FOUND, msg, HttpStatus.BAD_REQUEST);
        }

        if (dto.groupId != null) {
          const group = await queryRunner.manager.findOne(OrgGroupEntity, { where: { id: dto.groupId } });

          if (!group) {
            throw new AppError(
              ErrorCode.GROUP_NOT_FOUND,
              `Group with ID ${dto.groupId} does not exist`,
              HttpStatus.NOT_FOUND
            );
          }

          this.logger.verbose(`Updating device '${device.ID}' group to '${dto.groupId}'`);
          existingOrgId.group = group;
        } else {
          this.logger.verbose(`Set device '${device.ID}' group to 'null'`);
          existingOrgId.group = null;
        }
        await queryRunner.manager.save(existingOrgId);
      }

      await queryRunner.commitTransaction();
      return DevicePutDto.fromDeviceEntity(savedDevice);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Set Device transaction failed", err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

