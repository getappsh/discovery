import { DeviceConfigEntity } from "@app/common/database/entities/device-config.entity";
import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { AndroidConfigDto, fromConfigEntity, TargetStoragePolicy, WindowsConfigDto } from '@app/common/dto/device/dto/device-config.dto';
import { JobsEntity } from "@app/common/database/entities/map-updatesCronJob";
import * as bcrypt from 'bcrypt';


@Injectable()
export class DeviceConfigService implements OnApplicationBootstrap {

  private readonly logger = new Logger(DeviceConfigService.name);

  constructor(
    @InjectRepository(DeviceConfigEntity) private readonly configRepo: Repository<DeviceConfigEntity>,
    @InjectRepository(JobsEntity) private readonly jobRepo: Repository<JobsEntity>,
  ) { }

  async getDeviceConfig(group: string) {
    this.logger.log(`Get device config for group: ${group}`);
    let eConfig = await this.configRepo.findOneBy({ group: group })
    if (!eConfig) {
      throw new NotFoundException(`Not found config for group: '${group}'.`)
    }

    return this.configDtoFromEntity(eConfig);

  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  async setDeviceConfig(config: WindowsConfigDto | AndroidConfigDto) {
    delete config['headers']
    let eConfig = await this.setConfigValues(config)

    return this.configDtoFromEntity(eConfig)
  }

  async configDtoFromEntity(eConfig: DeviceConfigEntity): Promise<WindowsConfigDto | AndroidConfigDto> {
    let lastCheckPromise = this.getLastMapUpdatesChecking()

    let config = fromConfigEntity(eConfig)

    let technicianPassword = (config as WindowsConfigDto)?.technicianPassword;
    this.logger.debug(`Device config technicianPassword: ${technicianPassword}`)
    if (technicianPassword){
      const hashedPassword = await this.hashPassword(technicianPassword)
      this.logger.debug(`Device config hashed technicianPassword: ${hashedPassword}`)
      config['technicianPassword'] = hashedPassword
    }

    config.lastCheckingMapUpdatesDate = await lastCheckPromise;

    return config
  }


  async setConfigValues(config: WindowsConfigDto | AndroidConfigDto) {
    this.logger.debug(`Update device config group :${config.group}`)

    let eConfig = await this.configRepo.findOneBy({ group: config.group })
    if (!eConfig) {
      eConfig = this.configRepo.create()
      eConfig.data = {} as WindowsConfigDto | AndroidConfigDto;
      eConfig.group = config.group
    }

    if (config.group === "windows") {
      if ('layers' in config) {
        const layersConfig = (config as WindowsConfigDto).layers
        delete config.layers
        if (!(eConfig.data as WindowsConfigDto).layers) {
          (eConfig.data as WindowsConfigDto).layers = layersConfig?.filter((layer, index, self) =>
            !layer.delete && index === self.findIndex(l => l.layerName === layer.layerName)
          )
        } else {
          layersConfig?.forEach(layer => {
            const index = (eConfig.data as WindowsConfigDto).layers.findIndex(l => l.layerName === layer.layerName)
            if (index === -1) {
              if (!layer.delete) {
                (eConfig.data as WindowsConfigDto).layers.push(layer);
              }
            } else {
              if (!layer.delete) {
                (eConfig.data as WindowsConfigDto).layers[index] = layer
              } else {
                !["אורטופוטו", "מפת שליטה"].includes(layer.layerName)
                  ? (eConfig.data as WindowsConfigDto).layers.splice(index, 1)
                  : (eConfig.data as WindowsConfigDto).layers.splice(index, 1, { layerName: layer.layerName })
              }
            }
          })
        }
      }

      if ('getAppServerUrls' in config) {
        const setUrl = new Set((eConfig.data as WindowsConfigDto).getAppServerUrls as string[])
        const urlsConfig = (config as WindowsConfigDto).getAppServerUrls
        delete config.getAppServerUrls
        if (Array.isArray(urlsConfig)) {
          urlsConfig.every(url => typeof url === 'string')
            ? urlsConfig.forEach(setUrl.add, setUrl)
            : this.logger.error(`Invalid parameter in getAppServerUrls: ${urlsConfig}`);
        } else if (urlsConfig?.url) {
          urlsConfig.delete ? setUrl.delete(urlsConfig.url) : setUrl.add(urlsConfig.url)
        }
        (eConfig.data as WindowsConfigDto).getAppServerUrls = Array.from(setUrl)
      }
    }

    delete config.group
    for (const key in config) {
      eConfig.data[key] = config[key]
    }

    return await this.configRepo.save(eConfig)
  }

  async setDefaultAndroidConfig() {
    const eCong = await this.configRepo.findOneBy({ group: 'android' })

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
    const eCong = await this.configRepo.findOneBy({ group: 'windows' })
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
    defaults.layers = [{ "layerName": "אורטופוטו" }, { "layerName": "מפת שליטה" }]
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

