import { DatabaseModule } from '@app/common';
import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscoveryController } from './discovery/discovery.controller';
import { DiscoveryService } from './discovery/discovery.service';
import { BugReportEntity, DeviceEntity, DeviceMapStateEntity, OrgGroupEntity, MapEntity, UploadVersionEntity, OrgUIDEntity, DeviceComponentEntity, ReleaseEntity, PlatformEntity } from '@app/common/database/entities';
import { MicroserviceModule, MicroserviceName, MicroserviceType } from '@app/common/microservice-client';
import { GroupController } from './group/group.controller';
import { GroupService } from './group/group.service';
import { DeviceService } from './device/device.service';
import { DeviceController } from './device/device.controller';
import { DeviceClientRepoModule } from './modules/device-client-repo/device-client-repo.module';
import { LoggerModule } from '@app/common/logger/logger.module';
import { ApmModule } from '@app/common/apm/apm.module';
import { BugReportController } from './bug-report/bug-report.controller';
import { BugReportService } from './bug-report/bug-report.service';
import { S3Service } from '@app/common/AWS/s3.service';
import { MailModule } from '@app/common/mail/mail.module';
import { DeviceConfigEntity } from '@app/common/database/entities/device-config.entity';
import { DeviceConfigService } from './device/device-config.service';
import { JobsEntity } from '@app/common/database/entities/map-updatesCronJob';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    LoggerModule.forRoot({httpCls: false, jsonLogger: process.env.LOGGER_FORMAT === 'JSON', name: "Discovery"}),
    ApmModule,
    MicroserviceModule.register({
      name: MicroserviceName.OFFERING_SERVICE,
      type: MicroserviceType.OFFERING,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([
      DiscoveryMessageEntity, DeviceEntity, MapEntity,
       OrgGroupEntity,OrgUIDEntity, DeviceMapStateEntity, BugReportEntity,
        DeviceConfigEntity, JobsEntity, DeviceComponentEntity, ReleaseEntity, PlatformEntity
      ]),
    DeviceClientRepoModule,
    MailModule
  ],
  controllers: [DiscoveryController, GroupController, DeviceController, BugReportController],
  providers: [DiscoveryService, GroupService, DeviceService, BugReportService, S3Service, DeviceConfigService],
})
export class DiscoveryModule {}
