import { RuleType } from '../enums/rule.enums';
import { ReleaseIdentifierDto, RuleAssociationDto } from '../dto';

// Re-export DTOs as types for backward compatibility
export type ReleaseIdentifier = ReleaseIdentifierDto;
export type RuleAssociation = RuleAssociationDto;

export interface RuleDefinition {
  id: string;
  name: string;
  description?: string;
  type: RuleType;
  association: RuleAssociation;
  version: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  rule: any; // The actual rule object conforming to @usex/rule-engine
}

export interface RuleFieldDefinition {
  name: string;
  type: string;
  label: string;
  description?: string;
}
