import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeviceRepo, mockDiscoveryMessageRepo, mockMapRepo, mockUploadVersionRepo } from '@app/common/database/test/support/__mocks__';
import { ConfigModule } from '@nestjs/config';
import { DeviceEntity, DeviceMapStateEntity, MapEntity, UploadVersionEntity } from '@app/common/database/entities';
import { physicalDiscoveryDtoStub } from '@app/common/dto/discovery';
import { ComponentDto } from '@app/common/dto/discovery';
import { MapDto } from '@app/common/dto/map';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { DeviceService } from './device.service';
import { mockDeviceMapStateRepo } from '@app/common/database/test/support/__mocks__/device-map-state.repo.mock';
import { DeviceRepoService } from '../modules/device-client-repo/device-repo.service';

const mockDiscoveryMicroClient = {
  send: jest.fn().mockResolvedValue({}),
  emit: jest.fn().mockResolvedValue({})
}

const mockMicroserviceClient = {
  setClient: jest.fn(),
  send: jest.fn().mockResolvedValue({}),
  emit: jest.fn().mockResolvedValue({})
}
describe('DiscoveryService', () => {
  let discoveryService: DeviceService;
  let discoveryMessageRepo: Repository<DiscoveryMessageEntity>;
  let uploadVersionRepo: Repository<UploadVersionEntity>;
  let deviceRepo: Repository<DeviceEntity>;
  let microserviceClient: MicroserviceClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        DeviceService,
        DeviceRepoService,
        {
          provide: 'DISCOVERY_MICRO_SERVICE',
          useValue: mockDiscoveryMicroClient
        },
        {
          provide: getRepositoryToken(DiscoveryMessageEntity),
          useValue: mockDiscoveryMessageRepo()
        },
        {
          provide: getRepositoryToken(UploadVersionEntity),
          useValue: mockUploadVersionRepo()
        },
        {
          provide: getRepositoryToken(DeviceEntity),
          useValue: mockDeviceRepo()
        },
        {
          provide: getRepositoryToken(MapEntity),
          useValue: mockMapRepo()
        },
        {
          provide: getRepositoryToken(DeviceMapStateEntity),
          useValue: mockDeviceMapStateRepo()
        },
        {
          provide: MicroserviceName.MICRO_DISCOVERY_SERVICE,
          useValue: mockMicroserviceClient,
        }
      ],
    }).compile();

    discoveryService = module.get<DeviceService>(DeviceService);
    discoveryMessageRepo = module.get<Repository<DiscoveryMessageEntity>>(getRepositoryToken(DiscoveryMessageEntity));
    uploadVersionRepo = module.get<Repository<UploadVersionEntity>>(getRepositoryToken(UploadVersionEntity));
    deviceRepo = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
    microserviceClient = module.get<MicroserviceClient>(MicroserviceName.MICRO_DISCOVERY_SERVICE);

    jest.clearAllMocks()

  });
 
  describe('deviceInstalled', () => {
    it('should return the installed components and maps on a device', async () => {
      const deviceId = physicalDiscoveryDtoStub().ID;

      const result = await discoveryService.deviceInstalled(deviceId);
      expect(result.components.every(item => item instanceof ComponentDto)).toBe(true);
      expect(result.maps.every(item => item instanceof MapDto)).toBe(true);
      expect(deviceRepo.findOne).toHaveBeenCalledWith({ where: { ID: deviceId }, relations: { components: true, maps: { map: true } } });
      expect(deviceRepo.findOne).toHaveReturnedWith(expect.any(Promise));
    });
  });


  describe('registerSoftware', () => {
    it('should log the register data and return an empty string', () => {
      // const data = {} as DeviceRegisterDto;
      // const result = discoveryService.registerSoftware(data);
      // expect(result).toBe('');
    });
  });
});
