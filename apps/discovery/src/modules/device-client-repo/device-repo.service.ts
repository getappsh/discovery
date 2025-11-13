import { DeviceEntity, MapEntity, DeviceMapStateEntity, OrgGroupEntity } from "@app/common/database/entities";
import { OrgUIDEntity } from "@app/common/database/entities/org-uid.entity";
import { DevicePutDto } from "@app/common/dto/device/dto/device-put.dto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";


@Injectable()
export class DeviceRepoService {

  private readonly logger = new Logger(DeviceRepoService.name)

  constructor(
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(OrgUIDEntity) private readonly orgIdEntity: Repository<OrgUIDEntity>,
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
    const dvcOrgIds = await this.orgIdEntity.find({ where: { device: In(devices) } })
    return dvcOrgIds
  }

  async setDevice(p: DevicePutDto) {
    const device = await this.deviceRepo.findOne({ where: { ID: p.deviceId } })

    if (!device) {
      const mes = `Device ${p.deviceId} not exist`
      this.logger.error(mes)
      throw new BadRequestException(mes)
    }
    this.logger.log(`Save props for device ${device.ID}`)
    if (p.name !== undefined && p.name !== device.name) {
      this.logger.verbose(`Update device name from ${device.name} to ${p.name}`)
      device.name = p.name
    }
    const savedDevice = await this.deviceRepo.save(device)

    if ("orgUID" in p) {
      savedDevice.orgUID = await this.updateDeviceOrgId(p, device);
    }
    return DevicePutDto.fromDeviceEntity(savedDevice)
  }

  async updateDeviceOrgId(p: DevicePutDto, device: DeviceEntity) {
    const orgId = await this.orgIdEntity.findOne({
      where: { UID: p.orgUID },
      relations: ['device']
    }) || this.orgIdEntity.create({ UID: p.orgUID });

    const oldOrgId = await this.orgIdEntity.findOne({ where: { device: { ID: device.ID } } });

    if (p.orgUID != null) {
      if (orgId.device && orgId.device.ID !== device.ID) {
        this.logger.warn(`Changing orgUID '${orgId.UID}' from device '${orgId.device.ID}' to '${device.ID}'`);
      }
      orgId.UID = p.orgUID;
      orgId.device = device;
    } else {
      orgId.device = null;
    }

    await this.orgIdEntity.manager.transaction(async (manager) => {
      if (oldOrgId && oldOrgId.UID !== orgId.UID) {
        oldOrgId.device = null;
        await manager.save(OrgUIDEntity, oldOrgId);
      }
      await manager.upsert(OrgUIDEntity, orgId, ['UID']);
    });

    return await this.orgIdEntity.findOne({ where: { UID: orgId.UID } });
  }
}
