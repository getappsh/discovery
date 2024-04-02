import { DatabaseModule } from '@app/common';
import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DeviceEntity, DevicesGroupEntity, MapEntity, UploadVersionEntity } from '@app/common/database/entities';
import { MicroserviceModule, MicroserviceName, MicroserviceType } from '@app/common/microservice-client';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    MicroserviceModule.register({
      name: MicroserviceName.MICRO_DISCOVERY_SERVICE,
      type: MicroserviceType.MICRO_DISCOVERY,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([DiscoveryMessageEntity, UploadVersionEntity, DeviceEntity, MapEntity, DevicesGroupEntity]) 
  ],
  controllers: [DiscoveryController, GroupController],
  providers: [DiscoveryService, GroupService],
})
export class DiscoveryModule {}
