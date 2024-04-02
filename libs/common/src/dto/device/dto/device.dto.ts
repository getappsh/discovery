import { DeviceEntity } from "@app/common/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";
import { timeout } from 'rxjs';

export class DeviceDto {

  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({required: false})
  @IsDate()
  lastUpdatedDate: string
  
  @ApiProperty({required: false})
  @IsString()
  OS: string

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
  
  @ApiProperty({required: false})
  @IsBoolean()
  operativeState: true
  


  static fromDeviceEntity(de: any): DeviceDto{
    let device = new DeviceDto()
    device.id = de.ID;
    device.lastUpdatedDate = de.time
    device.OS = de.OS
    device.availableStorage = de.availableStorage;
    device.power = de.power;
    device.bandwidth = de.bandwidth;
    device.operativeState = de.operativeState;

    return device
  }

  toString(){
    return JSON.stringify(this);
  }
}