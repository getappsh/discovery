import { Injectable } from '@nestjs/common';
import { RuleService } from '@app/common/rules/services';
import { CreateRestrictionDto, UpdateRuleDto, RestrictionQueryDto } from '@app/common/rules/dto';
import { RuleType } from '@app/common/rules/enums/rule.enums';

@Injectable()
export class RestrictionsService {
  constructor(
    private readonly ruleService: RuleService,
  ) {}

  /**
   * Creates a new restriction (device/os-associated rule)
   */
  async createRestriction(createRestrictionDto: CreateRestrictionDto) {
    // Convert to internal CreateRuleDto format
    const createRuleDto = {
      ...createRestrictionDto,
      type: RuleType.RESTRICTION,
    };
    
    const rule = await this.ruleService.createRule(createRuleDto);
    return this.ruleService.ruleEntityToDefinition(rule);
  }

  /**
   * Updates an existing restriction
   */
  async updateRestriction(id: string, updateRuleDto: UpdateRuleDto) {
    const rule = await this.ruleService.updateRule(id, updateRuleDto);
    return this.ruleService.ruleEntityToDefinition(rule);
  }

  /**
   * Deletes a restriction
   */
  async deleteRestriction(id: string) {
    await this.ruleService.deleteRule(id);
    return { success: true, message: 'Restriction deleted successfully' };
  }

  /**
   * Gets a specific restriction by ID
   */
  async getRestriction(id: string) {
    const rule = await this.ruleService.findOneById(id);
    return this.ruleService.ruleEntityToDefinition(rule);
  }

  /**
   * Lists all restrictions with optional filters
   */
  async listRestrictions(query: RestrictionQueryDto) {
    // Force type to be restriction
    query.type = RuleType.RESTRICTION;
    
    const rules = await this.ruleService.findAll(query);
    return rules.map(rule => this.ruleService.ruleEntityToDefinition(rule));
  }
}
