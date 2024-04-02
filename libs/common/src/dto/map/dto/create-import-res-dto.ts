import { ApiProperty } from "@nestjs/swagger";
import { MapImportStatusEnum } from "@app/common/database/entities";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateImportResDto {

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  importRequestId: string;

  @ApiProperty({enum: MapImportStatusEnum})
  @IsEnum(MapImportStatusEnum)
  status: MapImportStatusEnum;

  @ApiProperty({required: false})
  messageLog: string;
 
  toString() {
    return JSON.stringify(this);
  }
}