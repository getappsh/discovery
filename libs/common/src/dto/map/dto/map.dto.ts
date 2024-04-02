import { MapEntity } from "@app/common/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class MapDto {

  @ApiProperty({required: false})
  catalogId: string;

  @ApiProperty({required: false})
  productId: string;
  
  @ApiProperty({required: false})
  productName: string;
  
  @ApiProperty({required: false})
  fileName: string;
  
  @ApiProperty({type: Number, minimum: 0, maximum: 18})
  @IsInt()
  @Min(0)
  @Max(18)
  zoomLevel: number
  
  @ApiProperty({required: false})
  createDate: Date;
  
  @ApiProperty({required: false})
  boundingBox: string;
  
  @ApiProperty({required: false})
  status: string;
  
  @ApiProperty({required: false})
  packageUrl: string;

  static fromMapEntity(mapEntity: MapEntity){
    let map = new MapDto();
    map.catalogId = mapEntity.catalogId;
    map.productId = mapEntity.productId;
    map.productName = mapEntity.productName;
    map.fileName = mapEntity.fileName;
    map.zoomLevel = mapEntity.zoomLevel;
    map.createDate = mapEntity.createDateTime;
    map.boundingBox = mapEntity.boundingBox;
    map.packageUrl = mapEntity.packageUrl;
    map.status = mapEntity.status;

    return map
  }

  toString(){
    return JSON.stringify(this);
  }
}