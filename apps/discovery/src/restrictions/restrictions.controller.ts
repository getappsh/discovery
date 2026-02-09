import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DeviceTopics } from '@app/common/microservice-client/topics';
import { RpcPayload } from '@app/common/microservice-client';
import { CreateRestrictionDto, UpdateRuleDto, RestrictionQueryDto } from '@app/common/rules/dto';
import { RestrictionsService } from './restrictions.service';
import { ValidateProjectAnyAccess } from '@app/common/utils/project-access';

@Controller()
export class RestrictionsController {
  private readonly logger = new Logger(RestrictionsController.name);

  constructor(private readonly restrictionsService: RestrictionsService) {}

  /**
   * Create a new restriction
   */
  @MessagePattern(DeviceTopics.CREATE_RESTRICTION)
  async createRestriction(@RpcPayload() createRestrictionDto: CreateRestrictionDto) {
    this.logger.log('Creating restriction');
    return this.restrictionsService.createRestriction(createRestrictionDto);
  }


  /**
   * Get all restrictions
   */
  @MessagePattern(DeviceTopics.GET_RESTRICTIONS)
  async getRestrictions(@RpcPayload() query: RestrictionQueryDto) {
    this.logger.log('Getting restrictions');
    return this.restrictionsService.listRestrictions(query || {});
  }


  /**
   * Get a specific restriction by ID
   */
  @MessagePattern(DeviceTopics.GET_RESTRICTION)
  async getRestriction(@RpcPayload() id: string) {
    this.logger.log(`Getting restriction ${id}`);
    return this.restrictionsService.getRestriction(id);
  }

  /**
   * Update a restriction
   */
  @MessagePattern(DeviceTopics.UPDATE_RESTRICTION)
  async updateRestriction(@RpcPayload() payload: { id: string; data: UpdateRuleDto }) {
    this.logger.log(`Updating restriction ${payload.id}`);
    return this.restrictionsService.updateRestriction(payload.id, payload.data);
  }

  /**
   * Delete a restriction
   */
  @MessagePattern(DeviceTopics.DELETE_RESTRICTION)
  async deleteRestriction(@RpcPayload() id: string) {
    this.logger.log(`Deleting restriction ${id}`);
    return this.restrictionsService.deleteRestriction(id);
  }
}
