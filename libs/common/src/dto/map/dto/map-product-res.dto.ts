import { ProductEntity } from "@app/common/database/entities";
import { MCRasterRecordDto } from "@app/common/dto/libot/dto/recordsRes.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class MapProductResDto {

  @ApiProperty()
  id: string

  @ApiProperty()
  productId: string;

  @ApiProperty({ required: false })
  productName: string;

  @ApiProperty({ required: false })
  productVersion: string;

  @ApiProperty({ required: false })
  productType: string;

  @ApiProperty({ required: false })
  productSubType: string;

  @ApiProperty({ required: false })
  description: string;

  @ApiProperty({ required: false })
  imagingTimeBeginUTC: Date;

  @ApiProperty({ required: false })
  imagingTimeEndUTC: Date;

  @ApiProperty({ required: false })
  maxResolutionDeg: number

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  footprint: string;

  @ApiProperty({ required: false })
  transparency: string

  @ApiProperty({ required: false })
  region: string;

  @ApiProperty({ required: false })
  ingestionDate: Date;

  toString() {
    return JSON.stringify(this);
  }


  static fromRecordsRes(records: MCRasterRecordDto): MapProductResDto {
    const product = new MapProductResDto()
    product.id = records["mc:id"]
    product.productId = records["mc:productName"]
    product.productName = records["mc:productName"]
    product.productVersion = records["mc:productVersion"]
    product.productType = records["mc:productType"]
    product.productSubType = records["mc:productSubType"];
    product.description = records["mc:description"];
    product.imagingTimeBeginUTC = new Date(records["mc:imagingTimeBeginUTC"]);
    product.imagingTimeEndUTC = new Date(records["mc:imagingTimeEndUTC"]);
    product.maxResolutionDeg = Number(records["mc:maxResolutionDeg"])
    product.footprint = records["mc:footprint"]
    product.transparency = records["mc:transparency"]
    product.region = records["mc:region"]
    product.ingestionDate = new Date(records["mc:ingestionDate"]);

    return product
  }

  static fromProductEntity(pE: ProductEntity): MapProductResDto {
    const product = new MapProductResDto()
    product.id = pE.id
    product.productId = pE.productId
    product.productName = pE.productName
    product.productVersion = pE.productVersion
    product.productType = pE.productType
    product.productSubType = pE.productSubType
    product.description = pE.description
    product.imagingTimeBeginUTC = new Date(pE.imagingTimeBeginUTC);
    product.imagingTimeEndUTC = new Date(pE.imagingTimeEndUTC);
    product.maxResolutionDeg = Number(pE.maxResolutionDeg)
    product.footprint = pE.footprint
    product.transparency = pE.transparency
    product.region = pE.region
    product.ingestionDate = new Date(pE.ingestionDate);

    return product
  }


}