import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingVersionEntity, PendingVersionStatus } from '@app/common/database/entities/pending-version.entity';
import { DeviceEntity, DeviceComponentEntity, ReleaseEntity, DeviceComponentStateEnum } from '@app/common/database/entities';
import { 
  AcceptPendingVersionDto, 
  PendingVersionDto, 
  PendingVersionListDto, 
  RejectPendingVersionDto,
  toPendingVersionDto,
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
export class PendingVersionService implements OnModuleInit {
  private readonly logger = new Logger(PendingVersionService.name);

  constructor(
    @InjectRepository(PendingVersionEntity) 
    private readonly pendingVersionRepo: Repository<PendingVersionEntity>,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(DeviceComponentEntity)
    private readonly deviceComponentRepo: Repository<DeviceComponentEntity>,
    @InjectRepository(ReleaseEntity)
    private readonly releaseRepo: Repository<ReleaseEntity>,
    @Inject(MicroserviceName.PROJECT_MANAGEMENT_SERVICE) 
    private readonly projectManagementClient: MicroserviceClient,
    @Inject(MicroserviceName.UPLOAD_SERVICE) 
    private readonly uploadClient: MicroserviceClient,
    private readonly cls: ClsService,
  ) {}

  async onModuleInit() {
    // Subscribe to response topics for Kafka request-response pattern
    this.projectManagementClient.subscribeToResponseOf([
      ProjectManagementTopics.GET_PROJECT_BY_IDENTIFIER,
      ProjectManagementTopics.CREATE_PROJECT,
    ]);
    this.uploadClient.subscribeToResponseOf([
      UploadTopics.SET_RELEASE,
    ]);
    
    await Promise.all([
      this.projectManagementClient.connect(),
      this.uploadClient.connect(),
    ]);
    
    this.logger.log('PendingVersionService initialized and connected to microservices');
  }

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
                { projectIdentifier: projectName }
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

    const versionDtos = versions.map(v => toPendingVersionDto(v));

    return {
      versions: versionDtos,
      total
    };
  }

  /**
   * Ensure project exists, create if necessary
   */
  private async ensureProjectExists(projectName: string, username: string, reason?: string): Promise<any> {
    try {
      const project = await lastValueFrom(
        this.projectManagementClient.send(
          ProjectManagementTopics.GET_PROJECT_BY_IDENTIFIER, 
          { projectIdentifier: projectName }
        )
      );
      this.logger.log(`Project ${projectName} already exists with ID: ${project.id}`);
      
      // Ensure project has projectName field set, fallback to name or parameter
      if (!project.projectName) {
        project.projectName = project.name || projectName;
      }
      
      return project;
    } catch (error) {
      // Project doesn't exist, create it
      this.logger.log(`Project ${projectName} not found, creating it`);
      const createProjectDto: CreateProjectDto = {
        name: projectName,
        projectName: projectName,
        description: `Auto-created from pending version: ${reason || 'Unknown device reported this project'}`,
        platforms: [],
        projectType: ProjectType.PRODUCT,
        username: username
      };
      
      const project = await lastValueFrom(
        this.projectManagementClient.send(ProjectManagementTopics.CREATE_PROJECT, createProjectDto)
      );
      this.logger.log(`Created project: ${projectName} with ID: ${project.id}`);
      return project;
    }
  }

  /**
   * Create release/version for the pending version
   */
  private async createReleaseForPendingVersion(
    project: any,
    version: string,
    reportingDeviceIds: string[],
    projectName: string,
    reason?: string,
    isDraft?: boolean
  ): Promise<ReleaseEntity> {
    // Use projectName parameter as fallback since project object might not have projectName field
    const projectIdentifier = project.projectName || project.name || projectName;
    
    const setReleaseDto: Partial<SetReleaseDto> & { projectId: number; version: string } = {
      projectId: project.id,
      projectIdentifier: projectIdentifier,
      version: version,
      name: `v${version}`,
      releaseNotes: reason || 'Auto-created from pending version reported by devices',
      metadata: {
        autoCreated: true,
        fromPendingVersion: true,
        reportedBy: reportingDeviceIds,
        createdAt: new Date().toISOString()
      },
      isDraft: isDraft ?? true,
      dependencies: []
    };

    const release = await lastValueFrom(
      this.uploadClient.send(UploadTopics.SET_RELEASE, setReleaseDto)
    );
    this.logger.log(`Created release: ${project.projectName}@${version} with catalogId: ${release.catalogId}`);

    return release;
  }

  /**
   * Create device_component entries for all devices that reported this version
   */
  private async createDeviceComponentsForVersion(
    deviceIds: string[],
    release: ReleaseEntity
  ): Promise<void> {
    this.logger.log(`Creating device_component entries for ${deviceIds.length} devices`);

    for (const deviceId of deviceIds) {
      // Check if device exists
      const device = await this.deviceRepo.findOne({ where: { ID: deviceId } });
      
      if (!device) {
        this.logger.warn(`Device ${deviceId} not found, skipping device_component creation`);
        continue;
      }

      // Check if device_component entry already exists
      const existingComponent = await this.deviceComponentRepo.findOne({
        where: {
          device: { ID: deviceId },
          release: { catalogId: release.catalogId }
        }
      });

      if (existingComponent) {
        this.logger.debug(`device_component entry already exists for device ${deviceId} and release ${release.catalogId}`);
        continue;
      }

      // Create new device_component entry
      const deviceComponent = this.deviceComponentRepo.create({
        device: device,
        release: release,
        state: DeviceComponentStateEnum.INSTALLED, // Device reported it, so it's installed
        deployedAt: new Date()
      });

      await this.deviceComponentRepo.save(deviceComponent);
      this.logger.log(`Created device_component entry for device ${deviceId} and release ${release.catalogId}`);
    }

    this.logger.log(`Successfully created ${deviceIds.length} device_component entries`);
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

    // Set user context in CLS for guards to accept the request
    this.cls.set('user', { email: dto.username, preferred_username: dto.username });

    try {
      // 1. Ensure project exists (create if necessary)
      const project = await this.ensureProjectExists(dto.projectName, dto.username, dto.reason);

      // 2. Create the release/version
      const release = await this.createReleaseForPendingVersion(
        project,
        dto.version,
        pendingVersion.reportingDeviceIds,
        dto.projectName,
        dto.reason,
        dto.isDraft
      );

      // 3. Create device_component entries for reporting devices
      await this.createDeviceComponentsForVersion(
        pendingVersion.reportingDeviceIds,
        release
      );

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

  /**
   * Get all pending versions for a specific device
   */
  async getPendingVersionsForDevice(deviceId: string): Promise<PendingVersionEntity[]> {
    this.logger.log(`Getting pending versions for device ${deviceId}`);
    
    const pendingVersions = await this.pendingVersionRepo
      .createQueryBuilder('pv')
      .where('pv.reportingDeviceIds @> :deviceIds', { deviceIds: JSON.stringify([deviceId]) })
      .andWhere('pv.status = :status', { status: PendingVersionStatus.PENDING })
      .getMany();

    return pendingVersions;
  }

  /**
   * Remove a device from a pending version's reportingDeviceIds
   * If no devices remain, delete the pending version entirely
   */
  async removeDeviceFromPendingVersion(
    projectName: string,
    version: string,
    deviceId: string
  ): Promise<void> {
    this.logger.log(`Removing device ${deviceId} from pending version: ${projectName}@${version}`);

    try {
      const pendingVersion = await this.pendingVersionRepo.findOne({
        where: { projectName, version, status: PendingVersionStatus.PENDING }
      });

      if (!pendingVersion) {
        this.logger.debug(`Pending version ${projectName}@${version} not found or not in PENDING status`);
        return;
      }

      // Remove device from reportingDeviceIds array
      const deviceIndex = pendingVersion.reportingDeviceIds.indexOf(deviceId);
      if (deviceIndex === -1) {
        this.logger.debug(`Device ${deviceId} not found in pending version ${projectName}@${version}`);
        return;
      }

      pendingVersion.reportingDeviceIds.splice(deviceIndex, 1);
      pendingVersion.reportedCount = pendingVersion.reportingDeviceIds.length;

      if (pendingVersion.reportingDeviceIds.length === 0) {
        // No devices left reporting this version, delete the pending version
        await this.pendingVersionRepo.remove(pendingVersion);
        this.logger.log(`Deleted pending version ${projectName}@${version} - no reporting devices remain`);
      } else {
        // Update the pending version with new device list
        await this.pendingVersionRepo.save(pendingVersion);
        this.logger.log(
          `Removed device ${deviceId} from pending version ${projectName}@${version}, ` +
          `${pendingVersion.reportedCount} device(s) still reporting`
        );
      }
    } catch (error) {
      this.logger.error(`Error removing device from pending version: ${error.message}`, error.stack);
    }
  }
}
