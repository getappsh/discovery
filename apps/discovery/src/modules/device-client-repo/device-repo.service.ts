import { DeviceEntity, MapEntity, DeviceMapStateEntity, OrgGroupEntity } from "@app/common/database/entities";
import { OrgUIDEntity } from "@app/common/database/entities/org-uid.entity";
import { DevicePutDto } from "@app/common/dto/device/dto/device-put.dto";
import { AppError, ErrorCode } from "@app/common/dto/error";
import { BadRequestException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
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
        UID: true,
        device: { ID: true, name: true }
      }
    })
    return dvcOrgIds
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

      if (dto.name !== undefined) {
        device.name = dto.name;
      }

      let savedDevice = await queryRunner.manager.save(device);

      if ("orgUID" in dto) {
        let orgId: OrgUIDEntity | null = null;

        if (dto.orgUID != null) {
          orgId = await queryRunner.manager.findOne(OrgUIDEntity, {
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

          const existingOrgId = await queryRunner.manager.findOne(OrgUIDEntity, {
            where: { device: { ID: device.ID } }
          });

          if (existingOrgId) {
            existingOrgId.device = null;
            await queryRunner.manager.save(existingOrgId);
          }

          if (orgId) {
            orgId.device = device;
          } else {
            orgId = queryRunner.manager.create(OrgUIDEntity, {
              UID: dto.orgUID,
              device: device
            });
          }
        } else {
          // Remove association
          orgId = await queryRunner.manager.findOne(OrgUIDEntity, {
            where: { device: { ID: device.ID } }
          });
          if (orgId) {
            orgId.device = null;
          }
        }

        if (orgId) {
          const savedOrgId = await queryRunner.manager.save(orgId);
          savedDevice.orgUID = savedOrgId;
        }
      }

      await queryRunner.commitTransaction();
      return DevicePutDto.fromDeviceEntity(savedDevice);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Transaction failed", err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

