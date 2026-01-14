import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DeviceTopics } from '@app/common/microservice-client/topics';
import { RpcPayload } from '@app/common/microservice-client';
import { CreateRestrictionDto, UpdateRuleDto, RestrictionQueryDto, CreateRuleFieldDto } from '@app/common/rules/dto';
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
  @ValidateProjectAnyAccess()
  @MessagePattern(DeviceTopics.GET_RESTRICTIONS)
  async getRestrictions(@RpcPayload() query: RestrictionQueryDto) {
    this.logger.log('Getting restrictions');
    return this.restrictionsService.listRestrictions(query || {});
  }


  /**
   * Get a specific restriction by ID
   */
  @ValidateProjectAnyAccess()
  @MessagePattern(DeviceTopics.GET_RESTRICTION)
  async getRestriction(@RpcPayload() id: string) {
    this.logger.log(`Getting restriction ${id}`);
    return this.restrictionsService.getRestriction(id);
  }

  /**
   * Update a restriction
   */
  @ValidateProjectAnyAccess()
  @MessagePattern(DeviceTopics.UPDATE_RESTRICTION)
  async updateRestriction(@RpcPayload() payload: { id: string; data: UpdateRuleDto }) {
    this.logger.log(`Updating restriction ${payload.id}`);
    return this.restrictionsService.updateRestriction(payload.id, payload.data);
  }

  /**
   * Delete a restriction
   */
  @ValidateProjectAnyAccess()
  @MessagePattern(DeviceTopics.DELETE_RESTRICTION)
  async deleteRestriction(@RpcPayload() id: string) {
    this.logger.log(`Deleting restriction ${id}`);
    return this.restrictionsService.deleteRestriction(id);
  }

  /**
   * Get available rule fields
   * This endpoint is used by multiple microservices (upload, api) via Kafka
   */
  @MessagePattern(DeviceTopics.GET_RULE_FIELDS)
  async getAvailableFields() {
    this.logger.log('Getting available rule fields');
    return this.restrictionsService.getAvailableFields();
  }

  /**
   * Add a new rule field
   * This endpoint is used by multiple microservices (upload, api) via Kafka
   */
  @MessagePattern(DeviceTopics.ADD_RULE_FIELD)
  async addRuleField(@RpcPayload() fieldData: CreateRuleFieldDto) {
    this.logger.log('Adding rule field');
    return this.restrictionsService.addRuleField(fieldData);
  }

  /**
   * Remove a rule field
   * This endpoint is used by multiple microservices (upload, api) via Kafka
   */
  @MessagePattern(DeviceTopics.REMOVE_RULE_FIELD)
  async removeRuleField(@RpcPayload() fieldName: string) {
    this.logger.log(`Removing rule field ${fieldName}`);
    return this.restrictionsService.removeRuleField(fieldName);
  }
}
