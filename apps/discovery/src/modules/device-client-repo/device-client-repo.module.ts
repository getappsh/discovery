import { DatabaseModule } from '@app/common';
import { DeviceEntity } from '@app/common/database/entities';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceRepoService } from './device-repo.service';
import { OrgUIDEntity } from '@app/common/database/entities/org-uid.entity';

@Module({
  imports:[
    DatabaseModule,
    TypeOrmModule.forFeature([DeviceEntity, OrgUIDEntity]),
  ],
  providers:[DeviceRepoService],
  exports: [DeviceRepoService]
})
export class DeviceClientRepoModule {}
