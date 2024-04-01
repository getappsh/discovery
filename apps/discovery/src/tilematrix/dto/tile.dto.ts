import { IsNumber } from "class-validator"

export class Tile {
  @IsNumber()
  x: number

  @IsNumber()
  y: number
  
  @IsNumber()
  zoom: number
}