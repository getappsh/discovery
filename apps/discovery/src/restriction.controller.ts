import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DeviceTopics } from '@app/common/microservice-client/topics';
import { RpcPayload } from '@app/common/microservice-client';
import { CreateRestrictionDto, UpdateRuleDto, RuleQueryDto, CreateRuleFieldDto } from '@app/common/rules/dto';
import { RestrictionService } from './restriction.service';
import { ValidateProjectAnyAccess } from '@app/common/utils/project-access';

@Controller()
export class RestrictionController {
  private readonly logger = new Logger(RestrictionController.name);

  constructor(private readonly restrictionService: RestrictionService) {}

  /**
   * Get all restrictions
   */
  @ValidateProjectAnyAccess()
  @MessagePattern(DeviceTopics.GET_RESTRICTIONS)
  async getRestrictions(@RpcPayload() query: RuleQueryDto) {
    this.logger.log('Getting restrictions');
    return this.restrictionService.listRestrictions(query || {});
  }

  /**
   * Create a new restriction
   */
  @ValidateProjectAnyAccess()
  @MessagePattern('getapp-device.create-restriction')
  async createRestriction(@RpcPayload() createRestrictionDto: CreateRestrictionDto) {
    this.logger.log('Creating restriction');
    return this.restrictionService.createRestriction(createRestrictionDto);
  }

  /**
   * Get a specific restriction by ID
   */
  @ValidateProjectAnyAccess()
  @MessagePattern('getapp-device.get-restriction')
  async getRestriction(@RpcPayload() id: string) {
    this.logger.log(`Getting restriction ${id}`);
    return this.restrictionService.getRestriction(id);
  }

  /**
   * Update a restriction
   */
  @ValidateProjectAnyAccess()
  @MessagePattern('getapp-device.update-restriction')
  async updateRestriction(@RpcPayload() payload: { id: string; data: UpdateRuleDto }) {
    this.logger.log(`Updating restriction ${payload.id}`);
    return this.restrictionService.updateRestriction(payload.id, payload.data);
  }

  /**
   * Delete a restriction
   */
  @ValidateProjectAnyAccess()
  @MessagePattern('getapp-device.delete-restriction')
  async deleteRestriction(@RpcPayload() id: string) {
    this.logger.log(`Deleting restriction ${id}`);
    return this.restrictionService.deleteRestriction(id);
  }

  /**
   * Get available rule fields
   */
  @MessagePattern('getapp-device.get-rule-fields')
  async getAvailableFields() {
    this.logger.log('Getting available rule fields');
    return this.restrictionService.getAvailableFields();
  }

  /**
   * Add a new rule field
   */
  @MessagePattern('getapp-device.add-rule-field')
  async addRuleField(@RpcPayload() fieldData: CreateRuleFieldDto) {
    this.logger.log('Adding rule field');
    return this.restrictionService.addRuleField(fieldData);
  }

  /**
   * Remove a rule field
   */
  @MessagePattern('getapp-device.remove-rule-field')
  async removeRuleField(@RpcPayload() fieldName: string) {
    this.logger.log(`Removing rule field ${fieldName}`);
    return this.restrictionService.removeRuleField(fieldName);
  }
}
