import { BugReportEntity, DeviceEntity, FileUploadEntity, FileUPloadStatusEnum } from "@app/common/database/entities";
import { BugReportDto, NewBugReportDto, NewBugReportResDto } from "@app/common/dto/bug-report";
import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DeviceService } from "../device/device.service";
import { DeviceDto } from "@app/common/dto/device/dto/device.dto";
import { S3Service } from "@app/common/AWS/s3.service";
import { MailService } from "@app/common/mail/mail.service";
import { CreateFileUploadUrlDto, FileUploadUrlDto } from "@app/common/dto/upload";
import { MicroserviceClient, MicroserviceName } from "@app/common/microservice-client";
import { UploadTopics } from "@app/common/microservice-client/topics";
import { lastValueFrom } from "rxjs";


@Injectable()
export class BugReportService implements OnModuleInit {
  private readonly logger = new Logger(BugReportService.name);

  constructor(
    @InjectRepository(BugReportEntity) private readonly bugReportRepository: Repository<BugReportEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepository: Repository<DeviceEntity>,
    @Inject(MicroserviceName.UPLOAD_SERVICE) private readonly uploadClient: MicroserviceClient,
    private readonly deviceService: DeviceService,
    private s3Service: S3Service,
    private mailService: MailService,
  ) { }



  async newBugReport(bugReport: NewBugReportDto) {
    this.logger.debug(`Create new bug report for device: ${bugReport.deviceId}`)
    const device = await this.deviceRepository.findOneBy({ ID: bugReport.deviceId })
    if (!device) {
      throw new NotFoundException(`Device ID: ${bugReport.deviceId} dose not exists`)
    }
    
    const fileUpload = new CreateFileUploadUrlDto()
    fileUpload.userId = "logs-report";
    fileUpload.fileName = `log-${Date.now()}.logs`
    fileUpload.objectKey = `${bugReport.deviceId}/`
   
    let dto: FileUploadUrlDto = await lastValueFrom(this.uploadClient.send(UploadTopics.CREATE_FILE_UPLOAD_URL, fileUpload))
    this.logger.debug(`File upload URL created: ${JSON.stringify(dto)}`)

    let fileEntity = new FileUploadEntity();
    fileEntity.id = dto.id;
    fileEntity.objectKey = dto.objectKey;

    let bug = this.bugReportRepository.create(bugReport);
    bug.device = device;
    bug.fileUpload = fileEntity;
    bug.startDate = bugReport.startDate;
    bug.endDate = bugReport.endDate;
    bug.agentVersion = bugReport.agentVersion;
    bug.description = bugReport.description;
    bug.logLevel = bugReport.logLevel;

    const res = await this.bugReportRepository.save(bug);
    
    // this.mailService.sendBugReport(bug.device.ID, bug.agentVersion, bug.description, (await (this.s3Service.generatePresignedUrlForDownload(bug.logsPath))))
    return new NewBugReportResDto(res.id, `/api/v1/upload/${dto.objectKey}`)

  }

  async getBugReport(bugId: string) {
    this.logger.debug(`get bug id ${bugId}`)
    const id = parseInt(bugId) || -1

    const bug = await this.bugReportRepository.findOne({ where: { id: id }, relations: { device: true, fileUpload: true } },)
    if (!bug) {
      throw new NotFoundException(`Bug id: ${id} dose not exists`)
    }

    const devices = await this.deviceService.deviceToDevicesDto([bug.device])

    let deviceDto: DeviceDto;
    if (devices.length > 0) {
      deviceDto = devices[0]
      let downloadUrl = '';
      if (bug?.fileUpload?.status === FileUPloadStatusEnum.UPLOADED){
          downloadUrl = await this.s3Service.generatePresignedUrlForDownload(bug.fileUpload.objectKey)
      }
      return BugReportDto.fromEntity(bug, deviceDto, downloadUrl)
    }
  }

  async onModuleInit() {
    this.uploadClient.subscribeToResponseOf([UploadTopics.CREATE_FILE_UPLOAD_URL]);
    await this.uploadClient.connect();
  }
}