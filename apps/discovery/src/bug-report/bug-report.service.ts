import { BugReportEntity, DeviceEntity } from "@app/common/database/entities";
import { BugReportDto, NewBugReportDto, NewBugReportResDto } from "@app/common/dto/bug-report";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DeviceService } from "../device/device.service";
import { DeviceDto } from "@app/common/dto/device/dto/device.dto";
import { MailService } from "@app/common/mail/mail.service";
import { ConfigService } from "@nestjs/config";
import { MinioClientService } from "@app/common/AWS/minio-client.service";


@Injectable()
export class BugReportService{
  private readonly logger = new Logger(BugReportService.name);
  private bucketName;
  constructor(
    @InjectRepository(BugReportEntity) private readonly bugReportRepository: Repository<BugReportEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepository: Repository<DeviceEntity>,
    private readonly deviceService: DeviceService,
    private mailService: MailService,
    private readonly minio: MinioClientService,
    private configService: ConfigService
  ){
    this.bucketName = this.configService.get('BUCKET_NAME')
  }



  async newBugReport(bugReport: NewBugReportDto){
    this.logger.debug(`Create new bug report for device: ${bugReport.deviceId}`)
    const device = await this.deviceRepository.findOneBy({ID: bugReport.deviceId})
    if (!device){
      throw new NotFoundException(`Device ID: ${bugReport.deviceId} dose not exists`)
    }

    let bug = this.bugReportRepository.create(bugReport);
    bug.device = device;

    const res = await this.bugReportRepository.save(bug);

    const path = `bugs-report/devices/${bugReport.deviceId}/bug-report-${res.id}.logs`
    this.logger.debug(`Logs path: ${path}`)
    res.logsPath = path;
    this.bugReportRepository.save(res);

    const uploadUrl = await this.minio.generatePresignedUploadUrl(this.bucketName, path)
    this.mailService.sendBugReport(bug.device.ID, bug.agentVersion, bug.description, (await (this.minio.generatePresignedDownloadUrl(this.bucketName, bug.logsPath))))
    return new NewBugReportResDto(res.id, uploadUrl)
  
  }

  async getBugReport(bugId: string){
    this.logger.debug(`get bug id ${bugId}`)
    const id = parseInt(bugId) || -1

    const bug = await this.bugReportRepository.findOne({where: {id: id}, relations: {device: true}},)
    if (!bug) {
      throw new NotFoundException(`Bug id: ${id} dose not exists`)
    }

    const devices = await this.deviceService.deviceToDevicesDto([bug.device])

    let deviceDto: DeviceDto;
    if (devices.length > 0){
      deviceDto = devices[0]
    }
    const downloadUrl = await this.minio.generatePresignedDownloadUrl(this.bucketName, bug.logsPath)
    return BugReportDto.fromEntity(bug, deviceDto, downloadUrl)
  }
  

}