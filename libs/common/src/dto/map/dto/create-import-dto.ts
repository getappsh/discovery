import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min, ValidateNested } from "class-validator";

export class MapProperties {

  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({type: Number, minimum: 0, maximum: 18})
  @IsInt()
  @Min(0)
  @Max(20)
  zoomLevel: number;

  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  boundingBox: string;

  @ApiProperty({required: false})
  @IsNumber()
  targetResolution: number;

  @ApiProperty({required: false})
  @IsNumber()
  @IsNotEmpty()
  lastUpdateAfter: number;

  toString() {
    return JSON.stringify(this);
  }

}

export class CreateImportDto {

  @ApiProperty({required: false})
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({required: false})
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => MapProperties)
  mapProperties: MapProperties;

  toString() {
    return JSON.stringify(this);
  }
}