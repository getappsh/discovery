import { IsLatitude, IsNumber } from "class-validator";

export class BBox {
  @IsNumber()
  left: number;

  @IsNumber()
  bottom: number;

  @IsNumber()
  right: number;

  @IsNumber()
  top: number;
}