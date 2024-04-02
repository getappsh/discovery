import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";


export class MapProductResDto {

  @ApiProperty({required: false})
  id: string

  @ApiProperty({required: false})
  productId: string;

  @ApiProperty({required: false})
  productName: string;

  @ApiProperty({required: false})
  productVersion: string;

  @ApiProperty({required: false})
  productType: string;

  @ApiProperty({required: false})
  productSubType: string;

  @ApiProperty({required: false})
  description: string;

  @ApiProperty({required: false})
  imagingTimeBeginUTC: Date;

  @ApiProperty({required: false})
  imagingTimeEndUTC: Date;

  @ApiProperty({required: false})
  maxResolutionDeg: number

  @ApiProperty({required: false})
  footprint: string;

  @ApiProperty({required: false})
  transparency: string
 
  @ApiProperty({required: false})
  region: string;

  @ApiProperty({required: false})
  ingestionDate: Date;

  toString() {
    return JSON.stringify(this);
  }

}

export enum MapOfferingStatus {
  SUCCESS = 'Success',
  ERROR = 'Error'
}

export class OfferingMapResDto {
  @ApiProperty({required: false, type: MapProductResDto, isArray: true})
  products: MapProductResDto[];

  @ApiProperty({enum: MapOfferingStatus})
  @IsEnum(MapOfferingStatus)
  status: MapOfferingStatus

  @ApiProperty({required: false})
  reason: string 
}