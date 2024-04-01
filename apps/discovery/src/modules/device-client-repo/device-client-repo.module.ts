import { DatabaseModule } from '@app/common';
import { DeviceEntity } from '@app/common/database/entities';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceRepoService } from './device-repo.service';

@Module({
  imports:[
    DatabaseModule,
    TypeOrmModule.forFeature([DeviceEntity]),
  ],
  providers:[DeviceRepoService],
  exports: [DeviceRepoService]
})
export class DeviceClientRepoModule {}
