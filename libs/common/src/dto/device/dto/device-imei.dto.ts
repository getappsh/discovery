import { ApiProperty } from "@nestjs/swagger";
import {IsString, IsNotEmpty } from "class-validator";

export class DeviceIMEI{

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  imei: string
  
  toString() {
    return JSON.stringify(this);
  }
}