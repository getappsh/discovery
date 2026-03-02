import { DeviceTopics } from '@app/common/microservice-client/topics';
import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { OSService } from './os.service';
import { OSEntity } from '@app/common/database/entities';
import { RpcPayload } from '@app/common/microservice-client';

@Controller()
export class OSController {
  private readonly logger = new Logger(OSController.name);

  constructor(private readonly osService: OSService) {}

  @MessagePattern(DeviceTopics.GET_ALL_OS)
  getAllOperatingSystems(@RpcPayload() _payload?: any): Promise<OSEntity[]> {
    this.logger.debug('Get all operating systems');
    return this.osService.getAllOperatingSystems();
  }
}
