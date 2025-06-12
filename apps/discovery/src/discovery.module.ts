import { DatabaseModule, UploadJwtConfigService } from '@app/common';
import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscoveryController } from './discovery/discovery.controller';
import { DiscoveryService } from './discovery/discovery.service';
import { BugReportEntity, DeviceEntity, DeviceMapStateEntity, OrgGroupEntity, MapEntity, UploadVersionEntity, OrgUIDEntity, DeviceComponentEntity, ReleaseEntity, PlatformEntity, DeviceTypeEntity, ProjectEntity, MemberProjectEntity } from '@app/common/database/entities';
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
import { HierarchyController } from './hierarchy/hierarchy.controller';
import { HierarchyService } from './hierarchy/hierarchy.service';
import { PROJECT_ACCESS_SERVICE } from '@app/common/utils/project-access';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    LoggerModule.forRoot({httpCls: false, jsonLogger: process.env.LOGGER_FORMAT === 'JSON', name: "Discovery"}),
    ApmModule,
    MicroserviceModule.register({
      name: MicroserviceName.OFFERING_SERVICE,
      type: MicroserviceType.OFFERING,
      id: "discovery"
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([
      DiscoveryMessageEntity, DeviceEntity, MapEntity,
       OrgGroupEntity,OrgUIDEntity, DeviceMapStateEntity, BugReportEntity, ProjectEntity, MemberProjectEntity,
        DeviceConfigEntity, JobsEntity, DeviceComponentEntity, ReleaseEntity, PlatformEntity, DeviceTypeEntity
      ]),
    DeviceClientRepoModule,
    MailModule,
    JwtModule.registerAsync({
      useClass: UploadJwtConfigService
    }),
  ],
  controllers: [DiscoveryController, GroupController, DeviceController, BugReportController, HierarchyController],
  providers: [DiscoveryService, GroupService, DeviceService, BugReportService, S3Service, DeviceConfigService, HierarchyService,
    {
      provide: PROJECT_ACCESS_SERVICE,
      useExisting: HierarchyService
    }
  ],
})
export class DiscoveryModule {}
