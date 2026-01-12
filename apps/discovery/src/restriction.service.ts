import { Injectable } from '@nestjs/common';
import { RuleService, RuleValidationService } from '@app/common/rules/services';
import { CreateRuleDto, UpdateRuleDto, RuleQueryDto, CreateRuleFieldDto } from '@app/common/rules/dto';
import { RuleType } from '@app/common/rules/enums/rule.enums';

@Injectable()
export class RestrictionService {
  constructor(
    private readonly ruleService: RuleService,
    private readonly ruleValidationService: RuleValidationService,
  ) {}

  /**
   * Creates a new restriction (device/os-associated rule)
   */
  async createRestriction(createRuleDto: CreateRuleDto) {
    // Ensure it's a restriction type
    createRuleDto.type = RuleType.RESTRICTION;
    
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
    return this.ruleService.deleteRule(id);
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
  async listRestrictions(query: RuleQueryDto) {
    // Force type to be restriction
    query.type = RuleType.RESTRICTION;
    
    const rules = await this.ruleService.findAll(query);
    return rules.map(rule => this.ruleService.ruleEntityToDefinition(rule));
  }

  /**
   * Gets all available rule fields
   */
  async getAvailableFields() {
    return this.ruleValidationService.getAvailableFields();
  }

  /**
   * Adds a new rule field
   */
  async addRuleField(fieldData: any) {
    return this.ruleValidationService.addRuleField(fieldData);
  }

  /**
   * Removes a rule field
   */
  async removeRuleField(fieldName: string) {
    return this.ruleValidationService.removeRuleField(fieldName);
  }
}
