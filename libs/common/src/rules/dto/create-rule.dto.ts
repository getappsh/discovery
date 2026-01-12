import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RuleType } from '../enums/rule.enums';

export class RuleAssociationDto {
  @ApiPropertyOptional({ type: [Number], description: 'Release IDs for policies' })
  @IsOptional()
  @IsNotEmpty({ each: true })
  releaseIds?: number[];

  @ApiPropertyOptional({ type: [String], description: 'Release names for policies' })
  @IsOptional()
  @IsString({ each: true })
  releaseNames?: string[];

  @ApiPropertyOptional({ type: [Number], description: 'Device type IDs for restrictions' })
  @IsOptional()
  @IsNotEmpty({ each: true })
  deviceTypeIds?: number[];

  @ApiPropertyOptional({ type: [String], description: 'Device type names for restrictions' })
  @IsOptional()
  @IsString({ each: true })
  deviceTypeNames?: string[];

  @ApiPropertyOptional({ type: [String], description: 'OS types for restrictions' })
  @IsOptional()
  @IsString({ each: true })
  osTypes?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Specific device IDs for restrictions' })
  @IsOptional()
  @IsString({ each: true })
  deviceIds?: string[];
}

export class CreateRuleDto {
  @ApiProperty({ description: 'Rule name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Rule description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: RuleType, description: 'Rule type (policy or restriction)' })
  @IsEnum(RuleType)
  type: RuleType;

  @ApiProperty({ type: RuleAssociationDto, description: 'Rule associations' })
  @ValidateNested()
  @Type(() => RuleAssociationDto)
  association: RuleAssociationDto;

  @ApiPropertyOptional({ description: 'Whether the rule is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: 'object', description: 'Rule engine compliant rule object' })
  @IsObject()
  @IsNotEmpty()
  rule: any;
}
