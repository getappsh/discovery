import { ApiProperty } from "@nestjs/swagger";

export enum PrepareStatusEnum {
  START = "start",
  IN_PROGRESS = "inProgress",
  DONE = "done",
  ERROR = "error",
}

export class PrepareDeliveryResDto{
  @ApiProperty()
  catalogId: string;

  @ApiProperty({enum: PrepareStatusEnum})
  status: PrepareStatusEnum

  @ApiProperty({required: false})
  url: string;

  toString(){
    return JSON.stringify(this);
  }
}