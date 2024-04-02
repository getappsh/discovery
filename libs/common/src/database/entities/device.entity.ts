import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { UploadVersionEntity } from "./upload-version.entity";
import { MapEntity } from "./map.entity";
import { DevicesGroupEntity } from "./devices-group.entity";

@Entity("device")
export class DeviceEntity {

  @PrimaryColumn({ name: 'ID' })
  ID: string;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  lastUpdatedDate: Date;

  @Column({ name: 'MAC', nullable: true })
  MAC: string;

  @Column({ name: 'IP', nullable: true })
  IP: string;

  @Column({ name: 'OS', nullable: true })
  OS: string;

  @Column({ name: 'serial_number', nullable: true })
  serialNumber: string;

  @Column({ name: 'possible_bandwidth', nullable: true })
  possibleBandwidth: string;

  @Column({ name: 'available_storage', nullable: true })
  availableStorage: string

  @ManyToMany(() => UploadVersionEntity, uploadVersionEntity => uploadVersionEntity.devices, {
    cascade: true
  })
  @JoinTable({
    name: "device_component",
    joinColumn: {
      name: 'device_ID',
      referencedColumnName: 'ID'
    },
    inverseJoinColumn: {
      name: "component_catalog_id",
      referencedColumnName: "catalogId"
    },

  })
  components: UploadVersionEntity[];

  @ManyToMany(() => MapEntity, mapEntity => mapEntity.devices, {
    cascade: true
  })
  @JoinTable({
    name: "device_map",
    joinColumn: {
      name: 'device_ID',
      referencedColumnName: 'ID'
    },
    inverseJoinColumn: {
      name: "map_catalog_id",
      referencedColumnName: "catalogId"
    },

  })
  maps: MapEntity[];

  
  @ManyToOne(type => DevicesGroupEntity, {nullable: true})
  groups: DevicesGroupEntity

}