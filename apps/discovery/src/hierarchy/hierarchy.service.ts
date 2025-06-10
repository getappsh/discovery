import { DeviceTypeEntity, PlatformEntity } from "@app/common/database/entities";
import { CreateDeviceTypeDto, CreatePlatformDto, DeviceTypeDto, DeviceTypeParams, PlatformDto, PlatformParams, UpdateDeviceTypeDto, UpdatePlatformDto } from "@app/common/dto/devices-hierarchy";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";


@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);

  constructor(
    @InjectRepository(PlatformEntity) private readonly platformRepo: Repository<PlatformEntity>,
    @InjectRepository(DeviceTypeEntity) private readonly deviceTypeRepo: Repository<DeviceTypeEntity>,
  ) {}


  
  // Create Platform
  async createPlatform(dto: CreatePlatformDto): Promise<PlatformDto> {
    this.logger.debug(`Create platform: ${dto.name}`);

     const exists = await this.platformRepo.findOneBy({ name: dto.name });
    if (exists) {
      throw new ConflictException(`Platform name: "${dto.name}" already exists`);
    }

    const platform = new PlatformEntity();
    platform.name = dto.name;
    platform.description = dto.description;
    platform.os = dto.os;

    try{
      const savedPlatform = await this.platformRepo.save(platform);
      return PlatformDto.fromEntity(savedPlatform);
    }catch (error) {
      this.logger.error(`Error while saving platform: ${error}`);
      if (error.code === '23505') { // Unique constraint violation error code for PostgreSQL
        throw new ConflictException('Platform name already exists');
      }
      throw error;
    }
  }

  async getPlatform(params: PlatformParams): Promise<PlatformDto> {
    this.logger.debug(`Get platform with name: ${params.name}`);
    const platform = await this.platformRepo.findOneBy({ name: params.name });
    if (!platform) {
      this.logger.warn(`Platform with name ${params.name} not found`);
      throw new NotFoundException('Platform not found');
    }
    return PlatformDto.fromEntity(platform);
  }


  async getPlatforms(query: string = ''): Promise<PlatformDto[]> {
    this.logger.debug(`Get platforms with query: ${query}`)
    return this.platformRepo.find({ where: { name: ILike(`%${query}%`) } }).then(platforms => platforms.map(platform => PlatformDto.fromEntity(platform)));
  }

  // Update Platform
  async updatePlatform(dto: UpdatePlatformDto): Promise<PlatformDto> {
    this.logger.debug(`Update platform: ${dto.name}`);
    const platform = await this.platformRepo.findOneBy({ name: dto.name });
    if (!platform) {
      throw new NotFoundException('Platform not found');
    }
    platform.name = dto.name || platform.name;
    platform.description = dto.description || platform.description;
    platform.os = dto.os || platform.os;

    await this.platformRepo.save(platform);

    return this.getPlatform({ name: platform.name });
  }

  // Delete Platform
  async deletePlatform(params: PlatformParams): Promise<string> {
    this.logger.debug(`Delete platform with name: ${params.name}`);
    const platform = await this.platformRepo.findOneBy({ name: params.name });
    if (!platform) {
      throw new NotFoundException('Platform not found');
    }
    await this.platformRepo.remove(platform);
    return `Platform ${params.name} deleted successfully`;
  }


  // Create Device Type
  async createDeviceType(dto: CreateDeviceTypeDto): Promise<DeviceTypeDto> {
    this.logger.debug(`Create device type: ${dto.name}`);

    const exists = await this.deviceTypeRepo.findOneBy({ name: dto.name });
    if (exists) {
      throw new ConflictException(`Device type name: "${dto.name}" already exists`);
    }
    const deviceType = new DeviceTypeEntity();
    deviceType.name = dto.name;
    deviceType.description = dto.description;

    try {
      const saved = await this.deviceTypeRepo.save(deviceType);
      return DeviceTypeDto.fromEntity(saved);
    } catch (error) {
      this.logger.error(`Error while saving device type: ${error}`);
      if (error.code === '23505') {
        throw new ConflictException('Device type name already exists');
      }
      throw error;
    }
  }

  // Get Device Type by Name
  async getDeviceType(params: DeviceTypeParams): Promise<DeviceTypeDto> {
    this.logger.debug(`Get device type with name: ${params.name}`);
    const deviceType = await this.deviceTypeRepo.findOneBy({ name: params.name });
    if (!deviceType) {
      throw new NotFoundException('Device type not found');
    }
    return DeviceTypeDto.fromEntity(deviceType);
  }

  // Get All Device Types (with optional query)
  async getDeviceTypes(query: string = ''): Promise<DeviceTypeDto[]> {
    this.logger.debug(`Get device types with query: ${query}`);
    const deviceTypes = await this.deviceTypeRepo.find({ where: { name: ILike(`%${query}%`) } });
    return deviceTypes.map(dt => DeviceTypeDto.fromEntity(dt));
  }

  // Update Device Type
  async updateDeviceType(dto: UpdateDeviceTypeDto): Promise<DeviceTypeDto> {
    this.logger.debug(`Update device type: ${dto.name}`);
    const deviceType = await this.deviceTypeRepo.findOneBy({ name: dto.name });
    if (!deviceType) {
      throw new NotFoundException('Device type not found');
    }
    deviceType.description = dto.description ?? deviceType.description;
    await this.deviceTypeRepo.save(deviceType);
    return this.getDeviceType({ name: deviceType.name });
  }

  // Delete Device Type
  async deleteDeviceType(params: DeviceTypeParams): Promise<string> {
    this.logger.debug(`Delete device type with name: ${params.name}`);
    const deviceType = await this.deviceTypeRepo.findOneBy({ name: params.name });
    if (!deviceType) {
      throw new NotFoundException('Device type not found');
    }
    await this.deviceTypeRepo.remove(deviceType);
    return `Device type ${params.name} deleted successfully`;
  }

}