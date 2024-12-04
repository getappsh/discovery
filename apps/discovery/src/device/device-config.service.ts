import { DeviceConfigEntity } from "@app/common/database/entities/device-config.entity";
import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { AndroidConfigDto, fromConfigEntity, TargetStoragePolicy, WindowsConfigDto } from '@app/common/dto/device/dto/device-config.dto';
import { JobsEntity } from "@app/common/database/entities/map-updatesCronJob";


@Injectable()
export class DeviceConfigService implements OnApplicationBootstrap{
 
  private readonly logger = new Logger(DeviceConfigService.name);

  constructor(
    @InjectRepository(DeviceConfigEntity) private readonly configRepo: Repository<DeviceConfigEntity>,
    @InjectRepository(JobsEntity) private readonly jobRepo: Repository<JobsEntity>,
  ) {}

  async getDeviceConfig(group: string){
    this.logger.log(`Get device config for group: ${group}`);
    let eConfig = await this.configRepo.findOneBy({group: group})
    if (!eConfig){
      throw new NotFoundException(`Not found config for group: '${group}'.`)
    }
    let configRes =  fromConfigEntity(eConfig)
    configRes.lastCheckingMapUpdatesDate = await this.getLastMapUpdatesChecking()

    return configRes;

  }

  async setDeviceConfig(config: WindowsConfigDto | AndroidConfigDto){
    delete config['headers']

    let eConfig = await this.setConfigValues(config)

    return fromConfigEntity(eConfig)
  }


  async setConfigValues(config: WindowsConfigDto | AndroidConfigDto){
    this.logger.debug(`Update device config group :${config.group}`)
    let eConfig = await this.configRepo.findOneBy({group: config.group})
    if (!eConfig) {
      eConfig = this.configRepo.create()
      eConfig.data = {};
      eConfig.group = config.group
    }
    delete config.group

    for (const key in config) {
      eConfig.data[key] = config[key]
    }

    return await this.configRepo.save(eConfig)
  }

  async setDefaultAndroidConfig() {
    const eCong = await this.configRepo.findOneBy({group: 'android'})

    const defaults = new AndroidConfigDto()
    defaults.deliveryTimeoutMins = 30
    defaults.downloadRetryTime = 3
    defaults.downloadTimeoutMins = 30
    defaults.MaxMapAreaSqKm = 100
    defaults.maxMapSizeInMB = 500
    defaults.maxParallelDownloads = 1
    defaults.minAvailableSpaceMB = 1000
    defaults.periodicInventoryIntervalMins = 1440
    defaults.periodicConfIntervalMins = 1440
    defaults.periodicMatomoIntervalMins = 1440
    defaults.mapMinInclusionInPercentages = 60
    defaults.targetStoragePolicy = TargetStoragePolicy.SD_ONLY
    defaults.sdStoragePath = "com.asio.gis/gis/maps/raster/מיפוי ענן"
    defaults.flashStoragePath = "com.asio.gis/gis/maps/raster/מיפוי ענן"
    defaults.ortophotoMapPath = "com.asio.gis/gis/maps/orthophoto/אורתופוטו.gpkg"
    defaults.controlMapPath = "com.asio.gis/gis/maps/orthophoto/מפת שליטה.gpkg"

    const defaultsToSave = Object.assign({}, defaults, eCong?.data)

    try {
      this.logger.log(`sets defaults configuration for android group`)
      await this.setConfigValues(defaultsToSave)
    } catch (error) {
      this.logger.error(error)
    }
  }

  async setDefaultWindowsConfig() {
    const eCong = await this.configRepo.findOneBy({group: 'windows'})
    const defaults = new WindowsConfigDto()
    defaults.deliveryTimeoutMins = 30
    defaults.downloadRetryTime = 3
    defaults.downloadTimeoutMins = 30
    defaults.MaxMapAreaSqKm = 100
    defaults.maxMapSizeInMB = 500
    defaults.maxParallelDownloads = 1
    defaults.minAvailableSpaceMB = 1000
    defaults.periodicInventoryIntervalMins = 1440
    defaults.periodicConfIntervalMins = 1440
    defaults.periodicMatomoIntervalMins = 1440
    defaults.mapMinInclusionInPercentages = 60

    const defaultsToSave = Object.assign({}, defaults, eCong?.data)

    try {
      this.logger.log(`sets defaults configuration for windows group`)
      await this.setConfigValues(defaultsToSave)
    } catch (error) {
      this.logger.error(error)
    }
  
  }


  async getLastMapUpdatesChecking(): Promise<Date> {
    const jobTime = await this.jobRepo.findOne({ where: { name: "mapUpdates", endTime: Not(IsNull()) }, order: { startTime: "DESC" } })
    return jobTime ? new Date(jobTime.endTime) : null
  }
  onApplicationBootstrap() {
    this.setDefaultAndroidConfig()
    this.setDefaultWindowsConfig()
  }


}
  
