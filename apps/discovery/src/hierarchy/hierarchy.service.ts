import { DeviceTypeEntity, MemberProjectEntity, PlatformEntity, ProjectEntity } from "@app/common/database/entities";
import { CreateDeviceTypeDto, CreatePlatformDto, DeviceTypeDto, DeviceTypeHierarchyDto, DeviceTypeParams, DeviceTypeProjectParams, PlatformDeviceTypeParams, PlatformDto, PlatformHierarchyDto, PlatformParams, UpdateDeviceTypeDto, UpdatePlatformDto } from "@app/common/dto/devices-hierarchy";
import { ProjectAccessService } from "@app/common/utils/project-access";
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";


@Injectable()
export class HierarchyService implements ProjectAccessService {
  private readonly logger = new Logger(HierarchyService.name);

  constructor(
    @InjectRepository(PlatformEntity) private readonly platformRepo: Repository<PlatformEntity>,
    @InjectRepository(DeviceTypeEntity) private readonly deviceTypeRepo: Repository<DeviceTypeEntity>,
    @InjectRepository(ProjectEntity) private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(MemberProjectEntity) private readonly memberProjectRepo: Repository<MemberProjectEntity>,
    private readonly jwtService: JwtService,
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
    platform.cpuArchitecture = dto.cpuArchitecture;
    platform.cpuCount = dto.cpuCount;
    platform.memoryMb = dto.memoryMb;
    platform.diskGb = dto.diskGb;
    platform.diskType = dto.diskType;
    platform.networkType = dto.networkType;
    platform.imageId = dto.imageId;
    platform.metadata = dto.metadata;

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
    this.logger.debug(`Get platform: ${params.platformId}`);
    const platform = await this.platformRepo.findOneBy({ id: params.platformId });
    if (!platform) {
      this.logger.warn(`Platform with id ${params.platformId} not found`);
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
    this.logger.debug(`Update platform: ${dto.id}`);
    const platform = await this.platformRepo.findOneBy({ id: dto.id });
    if (!platform) {
      throw new NotFoundException('Platform not found');
    }
    Object.assign(platform, dto);
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

  // Delete Platform
  async deletePlatform(params: PlatformParams): Promise<string> {
    this.logger.debug(`Delete platform: ${params.platformId}`);
    const platform = await this.platformRepo.findOneBy({ id: params.platformId });
    if (!platform) {
      throw new NotFoundException('Platform not found');
    }
    await this.platformRepo.remove(platform);
    return `Platform ${params.platformId} deleted successfully`;
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
    deviceType.os = dto.os;
    deviceType.cpuArchitecture = dto.cpuArchitecture;
    deviceType.cpuCount = dto.cpuCount;
    deviceType.memoryMb = dto.memoryMb;
    deviceType.diskGb = dto.diskGb;
    deviceType.diskType = dto.diskType;
    deviceType.networkType = dto.networkType;
    deviceType.imageId = dto.imageId;
    deviceType.metadata = dto.metadata;

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
    this.logger.debug(`Get device type: ${params.deviceTypeId}`);
    const deviceType = await this.deviceTypeRepo.findOneBy({ id: params.deviceTypeId });
    if (!deviceType) {
      throw new NotFoundException(`Device type: ${params.deviceTypeId} not found`);
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
    this.logger.debug(`Update device type: ${dto.id}`);
    const deviceType = await this.deviceTypeRepo.findOneBy({ id: dto.id });
    if (!deviceType) {
      throw new NotFoundException('Device type not found');
    }
    Object.assign(deviceType, dto);
    try {
      const savedDeviceType = await this.deviceTypeRepo.save(deviceType);
      return DeviceTypeDto.fromEntity(savedDeviceType);
    } catch (error) {
      this.logger.error(`Error while saving device type: ${error}`);
      if (error.code === '23505') {
        throw new ConflictException('Device type name already exists');
      }
      throw error;
    }
    
  }

  // Delete Device Type
  async deleteDeviceType(params: DeviceTypeParams): Promise<string> {
    this.logger.debug(`Delete device type: ${params.deviceTypeId}`);
    const deviceType = await this.deviceTypeRepo.findOneBy({ id: params.deviceTypeId });
    if (!deviceType) {
      throw new NotFoundException('Device type not found');
    }
    await this.deviceTypeRepo.remove(deviceType);
    return `Device type ${params.deviceTypeId} deleted successfully`;
  }

  async getPlatformHierarchy(params: PlatformParams): Promise<PlatformHierarchyDto> {
    this.logger.debug(`Getting full hierarchy tree for platform: ${params.platformId}`);
    const platform = await this.platformRepo.findOne({ 
      where: { id: params.platformId },
      relations: { deviceTypes: {projects: true} }, 
      select: { deviceTypes: { id: true, name: true, projects: {id: true, name: true} } } 
    });

    if (!platform) {
      throw new NotFoundException(`Platform: '${params.platformId}' not found`);
    }
    
    return PlatformHierarchyDto.fromPlatformEntity(platform);
  }

  async getDeviceTypeHierarchy(params: DeviceTypeParams): Promise<DeviceTypeHierarchyDto> {
    this.logger.debug(`Getting full hierarchy tree for device type: ${params.deviceTypeId}`);
    const deviceType = await this.deviceTypeRepo.findOne({ 
      where: { id: params.deviceTypeId },
      relations: { projects: true }, 
      select: { projects: {id: true, name: true} } 
    });
    if (!deviceType) {
      throw new NotFoundException(`Device type: '${params.deviceTypeId}' not found`);
    }
    return DeviceTypeHierarchyDto.fromDeviceTypeEntity(deviceType);
  }


  // add Device Type to Platform
  async addDeviceTypeToPlatform(params: PlatformDeviceTypeParams){
    this.logger.debug(`Add device type: '${params.deviceTypeId}' to platform: '${params.platformId}'`);
    const platform = await this.platformRepo.findOne({
      where: { id: params.platformId }, 
      relations: { deviceTypes: true },
      select: {deviceTypes: {id: true}}
    });
    if (!platform) {
      throw new NotFoundException(`Platform: '${params.platformId}' not found`);
    }

    if (platform.deviceTypes.some(dt => dt.id === params.deviceTypeId)) {
      throw new ConflictException(`Device type: '${params.deviceTypeId}' already exists in platform: '${params.platformId}'`);
    }
    
    const deviceType = await this.deviceTypeRepo.findOneBy({ id: params.deviceTypeId });
    if (!deviceType) {
      throw new NotFoundException(`Device type: '${params.deviceTypeId}' not found`);
    }
    
    platform.deviceTypes.push(deviceType);
    await this.platformRepo.save(platform);
    
    return this.getPlatformHierarchy({ platformId: params.platformId });
  }


  // remove Device Type from Platform
  async removeDeviceTypeFromPlatform(params: PlatformDeviceTypeParams) {
    this.logger.debug(`Remove device type: '${params.deviceTypeId}' from platform: '${params.platformId}'`);
    const platform = await this.platformRepo.findOne({
      where: { id: params.platformId }, 
      relations: { deviceTypes: true },
      select: {deviceTypes: {id: true}}
    });
    if (!platform) {
      throw new NotFoundException(`Platform: '${params.platformId}' not found`);
    }

    const deviceTypeIndex = platform.deviceTypes.findIndex(dt => dt.id === params.deviceTypeId);
    if (deviceTypeIndex === -1) {
      throw new NotFoundException(`Device type: '${params.deviceTypeId}' not found in platform: '${params.platformId}'`);
    }

    platform.deviceTypes.splice(deviceTypeIndex, 1);
    await this.platformRepo.save(platform);
    
    return this.getPlatformHierarchy({ platformId: params.platformId });
  }


  // Add Project to Device Type
  async addProjectToDeviceType(params: DeviceTypeProjectParams) {
    this.logger.debug(`Add project: '${params.projectId}' to device type: '${params.deviceTypeId}'`);
    const deviceType = await this.deviceTypeRepo.findOne({
      where: { id: params.deviceTypeId },
      relations: { projects: true },
      select: { projects: { id: true } }
    });
    
    if (!deviceType) {
      throw new NotFoundException(`Device type: '${params.deviceTypeId}' not found`);
    }

    if (deviceType.projects.some(p => p.id === params.projectId)) {
      throw new ConflictException(`Project: '${params.projectId}' already exists in device type: '${params.deviceTypeId}'`);
    }

    // Assuming ProjectEntity is imported and available
    const project = await this.projectRepo.findOne({ where: { id: params.projectId } });
    if (!project) {
      throw new NotFoundException(`Project with ID: '${params.projectId}' not found`);
    }

    deviceType.projects.push(project);
    await this.deviceTypeRepo.save(deviceType);
    
    return this.getDeviceTypeHierarchy({ deviceTypeId: params.deviceTypeId });
  }

  // Remove Project from Device Type
  async removeProjectFromDeviceType(params: DeviceTypeProjectParams) {
    this.logger.debug(`Remove project: '${params.projectId}' from device type: '${params.deviceTypeId}'`);
    const deviceType = await this.deviceTypeRepo.findOne({
      where: { id: params.deviceTypeId },
      relations: { projects: true },
      select: { projects: { id: true } }
    });
    
    if (!deviceType) {
      throw new NotFoundException(`Device type: '${params.deviceTypeId}' not found`);
    }

    const projectIndex = deviceType.projects.findIndex(p => p.id === params.projectId);
    if (projectIndex === -1) {
      throw new NotFoundException(`Project: '${params.projectId}' not found in device type: '${params.deviceTypeId}'`);
    }

    deviceType.projects.splice(projectIndex, 1);
    await this.deviceTypeRepo.save(deviceType);

    return this.getDeviceTypeHierarchy({ deviceTypeId: params.deviceTypeId });
  }
 
  getMemberInProject(projectIdentifier: number | string,  email: string): Promise<MemberProjectEntity> {
    this.logger.verbose(`Get member in project: ${projectIdentifier}, with email: ${email}`)

    const projectCondition = typeof projectIdentifier === 'number'
    ? { id: projectIdentifier }
    : { name: projectIdentifier };

    return this.memberProjectRepo.findOne({
      relations: ['project', 'member'],
      where: {
        project: projectCondition,
        member: { email: email }
      }
    }) as Promise<MemberProjectEntity>;
  }
  
  async getProjectFromToken(token: string): Promise<ProjectEntity> {
    const payload = this.jwtService.verify(token)
    const project = await this.projectRepo.findOne({ where: { id: payload.data.projectId, tokens: { token: token, isActive: true } } })
    if (!project) {
      throw new ForbiddenException('Not Allowed in this project');
    }
    return project;
  }
}
