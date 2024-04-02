import { DeviceEntity } from "@app/common/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";

export class DeviceMapDto {

  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({required: false})
  @IsString()
  zadikNumber: string


  @ApiProperty({required: false})
  @IsString()
  hardware: string

  @ApiProperty({required: false})
  @IsNotEmpty()
  formation: string

  @ApiProperty({required: false})
  @IsString()
  availableStorage: string

  @ApiProperty({required: false})
  @Min(0)
  @Max(100)
  power: number;

  @ApiProperty({required: false})
  @IsNumber()
  bandwidth: number;

  static fromDeviceEntity(de: DeviceEntity): DeviceMapDto{
    let device = new DeviceMapDto()
    device.id = de.ID;
    device.availableStorage = de.availableStorage;
// TODO
    return device
  }

  toString(){
    return JSON.stringify(this);
  }
}