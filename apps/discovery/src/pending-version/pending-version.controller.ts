import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { PendingVersionService } from './pending-version.service';
import { 
  AcceptPendingVersionDto, 
  PendingVersionListDto, 
  RejectPendingVersionDto,
  ListPendingVersionsQueryDto 
} from '@app/common/dto/discovery';
import { DeviceTopics, DeviceTopicsEmit } from '@app/common/microservice-client/topics';
import { RpcPayload } from '@app/common/microservice-client';

@Controller()
export class PendingVersionController {
  constructor(private readonly pendingVersionService: PendingVersionService) {}

  @MessagePattern(DeviceTopics.LIST_PENDING_VERSIONS)
  async listPendingVersions(
    @RpcPayload() query: ListPendingVersionsQueryDto
  ): Promise<PendingVersionListDto> {
    return this.pendingVersionService.listPendingVersions(
      query.status,
      query.limit,
      query.offset
    );
  }

  @EventPattern(DeviceTopicsEmit.ACCEPT_PENDING_VERSION)
  async acceptPendingVersion(
    @RpcPayload() dto: AcceptPendingVersionDto
  ): Promise<void> {
    await this.pendingVersionService.acceptPendingVersion(dto);
  }

  @EventPattern(DeviceTopicsEmit.REJECT_PENDING_VERSION)
  async rejectPendingVersion(
    @RpcPayload() dto: RejectPendingVersionDto
  ): Promise<void> {
    await this.pendingVersionService.rejectPendingVersion(dto);
  }
}
