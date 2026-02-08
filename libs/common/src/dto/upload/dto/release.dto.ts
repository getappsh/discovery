import { ProjectType, ReleaseEntity, ReleaseStatusEnum } from "@app/common/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsSemVer, IsString, IsBoolean } from "class-validator";
import { ReleaseArtifactDto } from "./release-artifact.dto";
import { Type } from "class-transformer";
import { ProjectIdentifierParams } from "@app/common/dto/project-management";
import { RuleType } from "@app/common/rules/enums/rule.enums";

export class ReleaseIdentifierDto {
  @ApiProperty({ description: 'Project name' })
  projectName: string;

  @ApiProperty({ description: 'Release version' })
  version: string;
}

export class PolicyAssociationDto {
  @ApiProperty({ description: 'Associated releases for policies', type: [ReleaseIdentifierDto], required: false })
  releases?: ReleaseIdentifierDto[];
}

export class RestrictionAssociationDto {
  @ApiProperty({ description: 'Associated device type names for restrictions', type: [String], required: false })
  deviceTypeNames?: string[];

  @ApiProperty({ description: 'Associated OS types for restrictions', type: [String], required: false })
  osTypes?: string[];

  @ApiProperty({ description: 'Associated device IDs for restrictions', type: [String], required: false })
  deviceIds?: string[];
}



export class ReleasePolicyDto {
  @ApiProperty({ description: 'Policy rule ID' })
  id: string;

  @ApiProperty({ description: 'Policy name' })
  name: string;

  @ApiProperty({ description: 'Policy description', required: false })
  description?: string;

  @ApiProperty({ description: 'Policy type', enum: RuleType })
  type: RuleType;

  @ApiProperty({ description: 'Policy associations (releases, device types, OS types, devices)', type: PolicyAssociationDto })
  association: PolicyAssociationDto;

  @ApiProperty({ description: 'Policy version number' })
  version: number;

  @ApiProperty({ description: 'Policy creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Policy last update timestamp' })
  updatedAt: string;

  @ApiProperty({ description: 'Whether the policy is active' })
  isActive: boolean;

  @ApiProperty({ description: 'The policy rule definition conforming to rule engine schema' })
  rule: any;
}

export class SetReleaseDto {

  projectIdentifier: string | number

  projectId: number

  @ApiProperty()
  @IsSemVer()
  version: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  releaseNotes?: string;

  @ApiProperty({ required: false, type: 'object' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean = true;

  @ApiProperty({ required: false, type: String, isArray: true, description: 'List of dependencies. Providing an empty array will remove all dependencies. Omitting this field or setting it to null will leave dependencies unchanged.' })
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  dependencies?: string[]

  toString() {
    return JSON.stringify(this)
  }

}

export class ReleaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty({ required: false })
  projectId?: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  releaseNotes: string;

  @ApiProperty()
  metadata: Record<string, any>;

  @ApiProperty({ type: 'enum', enum: ReleaseStatusEnum })
  status: ReleaseStatusEnum;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ description: 'Total number of required regulations' })
  requiredRegulationsCount: number;

  @ApiProperty({ description: 'Total number of compliant regulations' })
  compliantRegulationsCount: number;

  @ApiProperty()
  latest: boolean

  @ApiProperty({ required: false })
  releasedAt?: Date

  @ApiProperty({ required: false })
  createdBy?: string

  @ApiProperty({ required: false })
  updatedBy?: string

  static fromEntity(release: ReleaseEntity): ReleaseDto {
    const dto = new ReleaseDto();
    dto.version = release.version;
    dto.id = release.catalogId;
    dto.projectId = release?.project?.id;
    dto.projectName = release?.project?.name;
    dto.name = release.name || "";
    dto.releaseNotes = release.releaseNotes ?? "";
    dto.metadata = release.metadata;
    dto.status = release.status;
    dto.createdAt = release.createdAt;
    dto.updatedAt = release.updatedAt;
    dto.requiredRegulationsCount = release.requiredRegulationsCount;
    dto.compliantRegulationsCount = release.compliantRegulationsCount;
    dto.latest = release.latest;
    dto.releasedAt = release.releasedAt ?? undefined;
    dto.createdBy = release.createdBy ?? undefined;
    dto.updatedBy = release.updatedBy ?? undefined;

    return dto;
  }

  toString() {
    return JSON.stringify(this)
  }
}

export class DetailedReleaseDto extends ReleaseDto {

  @ApiProperty({ type: ReleaseArtifactDto, isArray: true, required: false })
  artifacts?: ReleaseArtifactDto[];

  @ApiProperty({ type: ReleaseDto, isArray: true, required: false })
  dependencies: ReleaseDto[]

  @ApiProperty({ type: ReleasePolicyDto, isArray: true, required: false, description: 'Policies associated with this release' })
  policies?: ReleasePolicyDto[];


  static fromEntity(release: ReleaseEntity): DetailedReleaseDto {
    const baseDto = super.fromEntity(release);
    const dto = new DetailedReleaseDto();

    Object.assign(dto, baseDto);

    dto.artifacts = release?.artifacts?.map(art => ReleaseArtifactDto.fromEntity(art))
    dto.dependencies = release?.dependencies?.map(dep => ReleaseDto.fromEntity(dep))
    dto.policies = release?.policyAssociations?.map(policyAssoc => {
      const policy = new ReleasePolicyDto();
      policy.id = policyAssoc.rule.id;
      policy.name = policyAssoc.rule.name;
      policy.description = policyAssoc.rule.description;
      policy.isActive = policyAssoc.rule.isActive;
      policy.rule = policyAssoc.rule.rule;
      return policy;
    }) ?? [];

    return dto

  }
}

export class ComponentV2Dto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty({ required: false })
  releaseNotes?: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;

  @ApiProperty({ type: 'enum', enum: ReleaseStatusEnum })
  status: ReleaseStatusEnum;

  @ApiProperty({ type: 'enum', enum: ProjectType })
  type: ProjectType

  @ApiProperty({ type: 'integer', format: 'int64', required: false })
  size?: number

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  latest?: boolean

  @ApiProperty({ required: false })
  releasedAt?: Date

  @ApiProperty({ required: false, type: [ReleasePolicyDto], description: 'Policies associated with this release' })
  policies?: ReleasePolicyDto[]

  static fromEntity(release: ReleaseEntity): ComponentV2Dto {
    const dto = new ComponentV2Dto();
    dto.version = release.version;
    dto.id = release.catalogId;
    dto.releaseNotes = release.releaseNotes;
    dto.metadata = release.metadata;
    dto.status = release.status;
    dto.createdAt = release.createdAt;
    dto.updatedAt = release.updatedAt;
    dto.projectName = release.project.name;
    dto.type = release.project.projectType;
    dto.latest = release.latest;
    dto.releasedAt = release.releasedAt ?? undefined;
    dto.size = release?.artifacts
      ?.filter(a => a.isInstallationFile)
      ?.map(a => a?.fileUpload?.size ?? 0)
      ?.reduce((size, a) => size + a, 0);
    return dto;
  }

  static fromPendingVersion(pendingVersion: any): ComponentV2Dto {
    const dto = new ComponentV2Dto();
    dto.id = pendingVersion.catalogId || `${pendingVersion.projectName}@${pendingVersion.version}`;
    dto.version = pendingVersion.version;
    dto.projectName = pendingVersion.projectName;
    dto.status = ReleaseStatusEnum.DRAFT;
    dto.type = ProjectType.PRODUCT;
    dto.createdAt = pendingVersion.firstReportedDate;
    dto.updatedAt = pendingVersion.lastReportedDate;
    dto.releaseNotes = `Version reported by device but not registered in getapp`;
    dto.metadata = pendingVersion.metadata || {};
    dto.latest = false;
    return dto;
  }

  toString() {
    return JSON.stringify(this)
  }
}

export class ReleaseParams extends ProjectIdentifierParams {
  @ApiProperty()
  @IsSemVer()
  @Type(() => String)
  version: string

  constructor(projectId: number, version: string) {
    super()
    this.projectId = projectId;
    this.version = version;
  }
}
