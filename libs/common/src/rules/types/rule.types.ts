import { RuleType } from '../enums/rule.enums';

export interface ReleaseIdentifier {
  projectName: string;
  version: string;
}

export interface RuleAssociation {
  // For policies (managed by upload service)
  releases?: ReleaseIdentifier[];
  
  // For restrictions (managed by discovery service)
  deviceTypeIds?: number[];
  deviceTypeNames?: string[];
  osTypes?: string[];
  deviceIds?: string[];
}

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
