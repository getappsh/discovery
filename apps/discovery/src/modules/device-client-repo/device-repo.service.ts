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

  async setDevice(p: DevicePutDto) {
    const device = await this.deviceRepo.findOne({ where: { ID: p.deviceId } })

    if (!device) {
      const mes = `Device ${p.deviceId} not exist`
      this.logger.error(mes)
      throw new BadRequestException(mes)
    }
    this.logger.log(`Save props for device ${device.ID}`)
    if (p.name !== undefined) {
      device.name = p.name
    }
    let savedDevice = await this.deviceRepo.save(device)

    if (p.orgUID) {
      let orgId: OrgUIDEntity | null;
      if (p.orgUID != null) {
        // TODO handle duplicate case
        orgId = this.orgIdEntity.create()
        orgId.UID = p.orgUID
        orgId.device = device

      } else {
        orgId = await this.orgIdEntity.findOne({ where: { device: { ID: device.ID } } })
        if (orgId) orgId.device = undefined
      }

      if (orgId) {
        const savedOrgId = await this.orgIdEntity.save(orgId);
        savedDevice.orgUID = savedOrgId
      }
    }
    return DevicePutDto.fromDeviceEntity(savedDevice)
  }
}
