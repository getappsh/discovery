import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DeviceTopics } from '@app/common/microservice-client/topics';
import { RpcPayload } from '@app/common/microservice-client';
import { CreateRestrictionDto, UpdateRuleDto, RestrictionQueryDto, EvaluateRuleDto, GetDeviceContextDto } from '@app/common/rules/dto';
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

  /**
   * Evaluate a rule (restriction or policy) against all devices.
   * Accepts either a ruleId (existing saved rule) or an inline rule JSON.
   * For policy rules the rule and its release associations are fetched from upload.
   * Returns the subset of devices whose latest discovery data satisfies the rule.
   */
  @MessagePattern(DeviceTopics.EVALUATE_RESTRICTION)
  async evaluateRule(@RpcPayload() dto: EvaluateRuleDto) {
    this.logger.log('Evaluating rule against devices');
    return this.restrictionsService.evaluateRule(dto);
  }

  /**
   * Returns the evaluation context built from the latest discovery message for a device.
   * The context structure is identical to what is used internally during rule evaluation.
   */
  @MessagePattern(DeviceTopics.GET_DEVICE_CONTEXT)
  async getDeviceContext(@RpcPayload() dto: GetDeviceContextDto) {
    this.logger.log(`Getting device context`);
    return this.restrictionsService.getDeviceContext(dto);
  }
}
