import { DatabaseModule } from '@app/common';
import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscoveryController } from './discovery/discovery.controller';
import { DiscoveryService } from './discovery/discovery.service';
import { DeviceEntity, DeviceMapStateEntity, DevicesGroupEntity, MapEntity, UploadVersionEntity } from '@app/common/database/entities';
import { MicroserviceModule, MicroserviceName, MicroserviceType } from '@app/common/microservice-client';
import { GroupController } from './group/group.controller';
import { GroupService } from './group/group.service';
import { DeviceService } from './device/device.service';
import { DeviceController } from './device/device.controller';
import { DeviceClientRepoModule } from './modules/device-client-repo/device-client-repo.module';
import { LoggerModule } from '@app/common/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    LoggerModule.forRoot({httpCls: false, jsonLogger: process.env.LOGGER_FORMAT === 'JSON', name: "Discovery"}),
    MicroserviceModule.register({
      name: MicroserviceName.MICRO_DISCOVERY_SERVICE,
      type: MicroserviceType.MICRO_DISCOVERY,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([DiscoveryMessageEntity, UploadVersionEntity, DeviceEntity, MapEntity, DevicesGroupEntity, DeviceMapStateEntity]),
    DeviceClientRepoModule 
  ],
  controllers: [DiscoveryController, GroupController, DeviceController],
  providers: [DiscoveryService, GroupService, DeviceService],
})
export class DiscoveryModule {}
