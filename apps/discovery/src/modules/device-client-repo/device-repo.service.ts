import { DeviceEntity, MapEntity, DeviceMapStateEntity } from "@app/common/database/entities";
import { DevicePutDto } from "@app/common/dto/device/dto/device-put.dto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";


@Injectable()
export class DeviceRepoService {

  private readonly logger = new Logger(DeviceRepoService.name)

  constructor(
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
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

  async setDevice(p: DevicePutDto) {
    const device = await this.deviceRepo.findOne({ where: { ID: p.deviceId } })

    if (!device) {
      const mes = `Device ${p.deviceId} not exist`
      this.logger.error(mes)
      throw new BadRequestException(mes)
    }
    this.logger.log(`Save props for device ${device.ID}`)
    device.name = p.name
    const savedDevice = await this.deviceRepo.save(device)
    return DevicePutDto.fromDeviceEntity(savedDevice)

  }
}
