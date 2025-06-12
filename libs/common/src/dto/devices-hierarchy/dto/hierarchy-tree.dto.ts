import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsString, IsNotEmpty } from "class-validator";


export class PlatformDeviceTypeParams {
  @ApiProperty({ description: "Name of the platform" })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    value.toLowerCase().trim().replace(/\s+/g, "-")
  )
  @Type(() => String)
  platformName: string;

  @ApiProperty({ description: "Name of the device type" })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    value.toLowerCase().trim().replace(/\s+/g, "-")
  )
  @Type(() => String)
  deviceTypeName: string;
}
