import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingVersionEntity, PendingVersionStatus } from '@app/common/database/entities/pending-version.entity';
import { 
  AcceptPendingVersionDto, 
  PendingVersionDto, 
  PendingVersionListDto, 
  RejectPendingVersionDto,
  CreateProjectVersionDto 
} from '@app/common/dto/discovery';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { Inject } from '@nestjs/common';
import { OfferingTopicsEmit } from '@app/common/microservice-client/topics';

@Injectable()
export class PendingVersionService {
  private readonly logger = new Logger(PendingVersionService.name);

  constructor(
    @InjectRepository(PendingVersionEntity) 
    private readonly pendingVersionRepo: Repository<PendingVersionEntity>,
    @Inject(MicroserviceName.OFFERING_SERVICE) 
    private readonly offeringClient: MicroserviceClient,
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

    const pendingVersion = await this.pendingVersionRepo.findOne({
      where: { projectName: dto.projectName, version: dto.version }
    });

    if (!pendingVersion) {
      throw new Error(`Pending version not found: ${dto.projectName}@${dto.version}`);
    }

    if (pendingVersion.status !== PendingVersionStatus.PENDING) {
      throw new Error(`Pending version already processed with status: ${pendingVersion.status}`);
    }

    // Update status to accepted
    pendingVersion.status = PendingVersionStatus.ACCEPTED;
    pendingVersion.reason = dto.reason;
    await this.pendingVersionRepo.save(pendingVersion);

    // Emit event to offering service to create project/version
    const createEvent: CreateProjectVersionDto = {
      projectName: dto.projectName,
      version: dto.version,
      isDraft: dto.isDraft ?? true,
      reason: dto.reason
    };

    try {
      this.offeringClient.emit(OfferingTopicsEmit.CREATE_PENDING_PROJECT_VERSION, createEvent);
      this.logger.log(`Emitted event to create project/version: ${dto.projectName}@${dto.version}`);
    } catch (error) {
      this.logger.error(`Error emitting create event: ${error.message}`, error.stack);
      // Revert status on error
      pendingVersion.status = PendingVersionStatus.PENDING;
      await this.pendingVersionRepo.save(pendingVersion);
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
