import { MapImportStatusEnum } from "@app/common/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ImportStatusResDto{

  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  deviceId : string;
  
  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  importRequestId : string;
  
  
  @ApiProperty({required: false})
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  packageUrl : string;

  @ApiProperty({required: false})
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fileName : string;

  @ApiProperty({required: false})
  @IsOptional()
  @IsDateString()
  createDate : Date;

  @ApiProperty({enum: MapImportStatusEnum, required: false})
  @IsEnum(MapImportStatusEnum)
  status: MapImportStatusEnum

  @ApiProperty({required: false})
  messageLog: string;
 
  toString(){
    return JSON.stringify(this);
  }
}
