import { ApiProperty, IntersectionType, PickType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsString, IsNotEmpty } from "class-validator";
import { ProjectIdentifierParams } from "../../project-management";


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

export class DeviceTypeProjectParams extends IntersectionType(
  PickType(PlatformDeviceTypeParams, ['deviceTypeName'] as const),
  ProjectIdentifierParams
) {

}
