import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { Repository } from 'typeorm';
import { DiscoveryMessageEntity } from '@app/common/database/entities/discovery-message.entity';
import { DiscoveryMessageDto } from '@app/common/dto/discovery';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeviceRepo, mockDiscoveryMessageRepo, mockMapRepo, mockUploadVersionRepo } from '@app/common/database/test/support/__mocks__';
import { discoveryMessageDtoStub } from '@app/common/dto/discovery';
import { ConfigModule } from '@nestjs/config';
import { OfferingTopics } from '@app/common/microservice-client/topics';
import { DeviceEntity, MapEntity, UploadVersionEntity } from '@app/common/database/entities';
import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';

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
  let discoveryService: DiscoveryService;
  let discoveryMessageRepo: Repository<DiscoveryMessageEntity>;
  let uploadVersionRepo: Repository<UploadVersionEntity>;
  let deviceRepo: Repository<DeviceEntity>;
  let microserviceClient: MicroserviceClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        DiscoveryService,
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
          provide: MicroserviceName.MICRO_DISCOVERY_SERVICE,
          useValue: mockMicroserviceClient,
        }
      ],
    }).compile();

    discoveryService = module.get<DiscoveryService>(DiscoveryService);
    discoveryMessageRepo = module.get<Repository<DiscoveryMessageEntity>>(getRepositoryToken(DiscoveryMessageEntity));
    uploadVersionRepo = module.get<Repository<UploadVersionEntity>>(getRepositoryToken(UploadVersionEntity));
    deviceRepo = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
    microserviceClient = module.get<MicroserviceClient>(MicroserviceName.MICRO_DISCOVERY_SERVICE);

    jest.clearAllMocks()

  });
  describe('discoveryMessage', () => {
    it('should create a new device and save the discovery message', async () => {
      const discoveryMessageDto: DiscoveryMessageDto = discoveryMessageDtoStub();

      await discoveryService.discoveryMessage(discoveryMessageDto);

      expect(deviceRepo.create).toHaveBeenCalledWith(discoveryMessageDto.general.physicalDevice);
      expect(deviceRepo.save).toHaveBeenCalledTimes(2);
      expect(uploadVersionRepo.find).toHaveBeenCalledWith({
        where: { catalogId: expect.anything() },
      });
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
      expect(discoveryMessageRepo.save).toHaveBeenCalledWith(expect.any(DiscoveryMessageEntity));
    });
  });


  describe('checkUpdates', () => {
    it('should send a Kafka message to check updates', async () => {
      const discovery: DiscoveryMessageDto = discoveryMessageDtoStub();

      discoveryService.checkUpdates(discovery);

      expect(microserviceClient.send).toHaveBeenCalledWith(OfferingTopics.CHECK_UPDATES, discovery);
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
