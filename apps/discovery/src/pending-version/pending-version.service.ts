import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingVersionEntity, PendingVersionStatus } from '@app/common/database/entities/pending-version.entity';
import { 
  AcceptPendingVersionDto, 
  PendingVersionDto, 
  PendingVersionListDto, 
  RejectPendingVersionDto,
} from '@app/common/dto/discovery';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { Inject } from '@nestjs/common';
import { ProjectManagementTopics, UploadTopics } from '@app/common/microservice-client/topics';
import { CreateProjectDto } from '@app/common/dto/project-management';
import { SetReleaseDto } from '@app/common/dto/upload';
import { lastValueFrom } from 'rxjs';
import { ProjectType } from '@app/common/database/entities';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PendingVersionService {
  private readonly logger = new Logger(PendingVersionService.name);

  constructor(
    @InjectRepository(PendingVersionEntity) 
    private readonly pendingVersionRepo: Repository<PendingVersionEntity>,
    @Inject(MicroserviceName.PROJECT_MANAGEMENT_SERVICE) 
    private readonly projectManagementClient: MicroserviceClient,
    @Inject(MicroserviceName.UPLOAD_SERVICE) 
    private readonly uploadClient: MicroserviceClient,
    private readonly cls: ClsService,
  ) {}

  /**
   * Store or update a pending version when a device reports an unknown version
   */
  async recordPendingVersion(
    projectName: string,
    version: string,
    deviceId: string,
    catalogId?: string
  ): Promise<void> {
    this.logger.log(`Recording pending version: ${projectName}@${version} from device ${deviceId}`);

    try {
      // Check if this version is already recorded
      let pendingVersion = await this.pendingVersionRepo.findOne({
        where: { projectName, version }
      });

      if (pendingVersion) {
        // Update existing record
        if (!pendingVersion.reportingDeviceIds.includes(deviceId)) {
          pendingVersion.reportingDeviceIds.push(deviceId);
          pendingVersion.reportedCount = pendingVersion.reportingDeviceIds.length;
        }
        pendingVersion.lastReportedDate = new Date();
        
        if (catalogId && !pendingVersion.catalogId) {
          pendingVersion.catalogId = catalogId;
        }

        // If status is ACCEPTED, check if the project still exists
        if (pendingVersion.status === PendingVersionStatus.ACCEPTED) {
          try {
            await lastValueFrom(
              this.projectManagementClient.send(
                ProjectManagementTopics.GET_PROJECT_BY_IDENTIFIER, 
                projectName
              )
            );
            // Project exists, keep status as ACCEPTED
          } catch (error) {
            // Project not found (likely deleted), reset status to PENDING
            this.logger.warn(`Project ${projectName} was accepted but no longer exists. Resetting to PENDING.`);
            pendingVersion.status = PendingVersionStatus.PENDING;
          }
        }

        await this.pendingVersionRepo.save(pendingVersion);
        this.logger.log(`Updated pending version: ${projectName}@${version}, total reports: ${pendingVersion.reportedCount}`);
      } else {
        // Create new record
        pendingVersion = this.pendingVersionRepo.create({
          projectName,
          version,
          catalogId,
          status: PendingVersionStatus.PENDING,
          reportedCount: 1,
          firstReportedDate: new Date(),
          lastReportedDate: new Date(),
          reportingDeviceIds: [deviceId],
          metadata: {}
        });

        await this.pendingVersionRepo.save(pendingVersion);
        this.logger.log(`Created new pending version: ${projectName}@${version}`);
      }
    } catch (error) {
      this.logger.error(`Error recording pending version: ${error.message}`, error.stack);
    }
  }

  /**
   * Get all pending versions with pagination and filtering
   */
  async listPendingVersions(
    status?: PendingVersionStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<PendingVersionListDto> {
    this.logger.log(`Listing pending versions with status: ${status || 'all'}`);

    const queryBuilder = this.pendingVersionRepo
      .createQueryBuilder('pv')
      .orderBy('pv.lastReportedDate', 'DESC');

    if (status) {
      queryBuilder.where('pv.status = :status', { status });
    }

    const [versions, total] = await queryBuilder
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const versionDtos: PendingVersionDto[] = versions.map(v => ({
      id: v.id,
      projectName: v.projectName,
      version: v.version,
      catalogId: v.catalogId,
      status: v.status,
      reportedCount: v.reportedCount,
      firstReportedDate: v.firstReportedDate,
      lastReportedDate: v.lastReportedDate,
      reportingDeviceIds: v.reportingDeviceIds,
      metadata: v.metadata,
      reason: v.reason
    }));

    return {
      versions: versionDtos,
      total
    };
  }

  /**
   * Accept a pending version and create the project/version via Kafka
   */
  async acceptPendingVersion(dto: AcceptPendingVersionDto): Promise<void> {
    this.logger.log(`Accepting pending version: ${dto.projectName}@${dto.version}`);

    if (!dto.username) {
      throw new Error('Username is required to accept a pending version');
    }

    const pendingVersion = await this.pendingVersionRepo.findOne({
      where: { projectName: dto.projectName, version: dto.version }
    });

    if (!pendingVersion) {
      throw new Error(`Pending version not found: ${dto.projectName}@${dto.version}`);
    }

    if (pendingVersion.status !== PendingVersionStatus.PENDING) {
      throw new Error(`Pending version already processed with status: ${pendingVersion.status}`);
    }

    try {
      // First, check if project exists, if not create it
      let project: any;
      try {
        project = await lastValueFrom(
          this.projectManagementClient.send(
            ProjectManagementTopics.GET_PROJECT_BY_IDENTIFIER, 
            dto.projectName
          )
        );
        this.logger.log(`Project ${dto.projectName} already exists with ID: ${project.id}`);
      } catch (error) {
        // Project doesn't exist, create it
        this.logger.log(`Project ${dto.projectName} not found, creating it`);
        const createProjectDto: CreateProjectDto = {
          name: dto.projectName,
          projectName: dto.projectName,
          description: `Auto-created from pending version: ${dto.reason || 'Unknown device reported this project'}`,
          platforms: [],
          projectType: ProjectType.PRODUCT,
          username: dto.username
        };
        
        project = await lastValueFrom(
          this.projectManagementClient.send(ProjectManagementTopics.CREATE_PROJECT, createProjectDto)
        );
        this.logger.log(`Created project: ${dto.projectName} with ID: ${project.id}`);
      }

      // Now create the release/version using the projectId
      const setReleaseDto: Partial<SetReleaseDto> & { projectId: number; version: string } = {
        projectId: project.id,
        projectIdentifier: dto.projectName,
        version: dto.version,
        name: `v${dto.version}`,
        releaseNotes: dto.reason || 'Auto-created from pending version reported by devices',
        metadata: {
          autoCreated: true,
          fromPendingVersion: true,
          reportedBy: pendingVersion.reportingDeviceIds,
          createdAt: new Date().toISOString()
        },
        isDraft: dto.isDraft ?? true,
        dependencies: []
      };

      // Set user context in CLS for the upload service guard to accept the request
      this.cls.set('user', { email: dto.username, preferred_username: dto.username });

      await lastValueFrom(
        this.uploadClient.send(UploadTopics.SET_RELEASE, setReleaseDto)
      );
      this.logger.log(`Created release: ${dto.projectName}@${dto.version}`);

      // Update status to accepted
      pendingVersion.status = PendingVersionStatus.ACCEPTED;
      pendingVersion.reason = dto.reason;
      await this.pendingVersionRepo.save(pendingVersion);
      
    } catch (error) {
      this.logger.error(`Error creating project/version: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reject a pending version and remove it from the database
   */
  async rejectPendingVersion(dto: RejectPendingVersionDto): Promise<void> {
    this.logger.log(`Rejecting pending version: ${dto.projectName}@${dto.version}`);

    const pendingVersion = await this.pendingVersionRepo.findOne({
      where: { projectName: dto.projectName, version: dto.version }
    });

    if (!pendingVersion) {
      throw new Error(`Pending version not found: ${dto.projectName}@${dto.version}`);
    }

    if (pendingVersion.status !== PendingVersionStatus.PENDING) {
      throw new Error(`Pending version already processed with status: ${pendingVersion.status}`);
    }

    // Update status to rejected and keep record for audit
    pendingVersion.status = PendingVersionStatus.REJECTED;
    pendingVersion.reason = dto.reason;
    await this.pendingVersionRepo.save(pendingVersion);

    this.logger.log(`Rejected pending version: ${dto.projectName}@${dto.version}`);
  }

  /**
   * Check if a project/version combination is pending
   */
  async isPending(projectName: string, version: string): Promise<boolean> {
    const count = await this.pendingVersionRepo.count({
      where: { 
        projectName, 
        version, 
        status: PendingVersionStatus.PENDING 
      }
    });
    return count > 0;
  }
}
