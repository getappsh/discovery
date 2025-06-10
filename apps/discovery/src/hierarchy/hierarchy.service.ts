import { DeviceTypeEntity } from "@app/common/database/entities";
import { CreateDeviceTypeDto, DeviceTypeDto, DeviceTypeParams, UpdateDeviceTypeDto } from "@app/common/dto/devices-hierarchy";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";


@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);

  constructor(
    @InjectRepository(DeviceTypeEntity) private readonly deviceTypeRepo: Repository<DeviceTypeEntity>,
  ) {}

  // Create Device Type
  async createDeviceType(dto: CreateDeviceTypeDto): Promise<DeviceTypeDto> {
    this.logger.debug(`Create device type: ${dto.name}`);

     const exists = await this.deviceTypeRepo.findOneBy({ name: dto.name });
    if (exists) {
      throw new ConflictException(`Device type name: ${dto.name} already exists`);
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