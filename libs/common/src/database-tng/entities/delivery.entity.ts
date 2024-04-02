
import { PrepareDeliveryReqDto, PrepareStatusEnum } from "@app/common/dto/delivery";
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("delivery")
export class DeliveryEntity{

  @PrimaryColumn({name: "catalog_id"})
  catalogId: string;

  @Column({
    name: 'status',
    type: "enum",
    enum: PrepareStatusEnum,
    default: PrepareStatusEnum.START
  })
  status: PrepareStatusEnum;

  @Column({name: "device_id"})
  deviceId: string;
  
  @Column({name: "path", nullable: true})
  path: string;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  lastUpdatedDate: Date;


  static fromPrepDlvReqDto(prepDlv: PrepareDeliveryReqDto): DeliveryEntity{
    let dlv = new DeliveryEntity()
    dlv.catalogId = prepDlv.catalogId;
    dlv.deviceId = prepDlv.deviceId;
    
    return dlv;
  }
}