import { DeviceEntity } from "@app/common/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { DiscoveryMessageV2Dto } from "../../discovery";
import { Logger } from "@nestjs/common";

export class DevicePutDto {
  static logger = new Logger(DevicePutDto.name)

  deviceId: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name: string

  @ApiProperty({ required: false, description: "Set the unique given id or null to remove the exists uid." })
  @IsOptional()
  @IsNumber()
  orgUID: number | null

  toString() {
    return JSON.stringify(this);
  }

  static fromDeviceEntity(dE: DeviceEntity) {
    const device = new DevicePutDto()
    device.deviceId = dE.ID
    device.name = dE.name

    if (dE.orgUID && dE.orgUID.UID) {
      device.orgUID = dE.orgUID.UID
    }

    return device
  }

  static fromDeviceDiscovery(dto: DiscoveryMessageV2Dto) {
    const device = new DevicePutDto()
    device.deviceId = dto.general.physicalDevice.ID
    device.name = dto.general.personalDevice.name

    if (dto.general.physicalDevice.serialNumber) {

      device.orgUID = parseInt(dto.general.physicalDevice.serialNumber)
      if (isNaN(device.orgUID)) {
        this.logger.warn(`Cannot parse serialNumber ${dto.general.physicalDevice.serialNumber} to number for orgUID from device ${device.deviceId} - setting orgUID to null`)
        device.orgUID = null
      }
    }

    return device
  }
}