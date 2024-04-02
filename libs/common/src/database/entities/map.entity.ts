import { Column, CreateDateColumn, Entity, ManyToMany, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { MapImportStatusEnum } from "./enums.entity";
import { DeviceEntity } from "./device.entity";

@Entity("map")
export class MapEntity {
  
  @PrimaryColumn({ name: 'catalog_id' })
  catalogId: string;
  
  @CreateDateColumn({name: 'create_date'})
  createDateTime: Date;

  @UpdateDateColumn()
  lastUpdatedDate: Date;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'product_name', nullable: true })
  productName: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'zoom_level', nullable: true })
  zoomLevel: number;
  

  @Column({ name: 'bounding_box', nullable: true })
  boundingBox: string;

  @Column({ name: 'package_url', nullable: true })
  packageUrl: string;

  @Column({
     name: 'status',
     type: "enum",
     enum: MapImportStatusEnum,
     default: MapImportStatusEnum.START,
    })
  status: MapImportStatusEnum;

  @ManyToMany(() => DeviceEntity, deviceEntity => deviceEntity.maps)
  devices: DeviceEntity[]

  toString(){
    return JSON.stringify(this)
  }
}
