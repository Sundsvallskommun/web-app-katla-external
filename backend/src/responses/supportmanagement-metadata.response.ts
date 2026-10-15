import { Type as TypeTransformer } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

import {
  AttachmentPurpose,
  Category,
  ContactReason,
  ExternalIdType,
  Label,
  LabelAttribute,
  Labels,
  MetadataResponse,
  Phase,
  PhaseTransition,
  Role,
  Status,
  Type,
} from '@/data-contracts/support-management-alkt-sprint/data-contracts';

export class TypeDTO implements Type {
  @IsString()
  name!: string;
  @IsString()
  @IsOptional()
  displayName?: string;
  @IsString()
  @IsOptional()
  escalationEmail?: string;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class CategoryDTO implements Category {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  @IsOptional()
  name?: string;
  @IsString()
  @IsOptional()
  displayName?: string;
  @IsNumber()
  @IsOptional()
  sortOrder?: number | null;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => TypeDTO)
  types?: TypeDTO[];
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class ExternalIdTypeDTO implements ExternalIdType {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  name!: string;
  @IsString()
  @IsOptional()
  displayName?: string | null;
  @IsNumber()
  @IsOptional()
  sortOrder?: number | null;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class LabelAttributeDTO implements LabelAttribute {
  @IsString()
  key!: string;
  @IsString()
  value!: string;
}

export class LabelDTO implements Label {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  classification!: string;
  @IsString()
  @IsOptional()
  displayName?: string;
  @IsString()
  @IsOptional()
  resourcePath?: string;
  @IsString()
  resourceName!: string;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => LabelDTO)
  labels?: LabelDTO[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @TypeTransformer(() => LabelAttributeDTO)
  attributes?: LabelAttributeDTO[];
}

export class LabelsDTO implements Labels {
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => LabelDTO)
  labelStructure?: LabelDTO[];
}

export class StatusDTO implements Status {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  name!: string;
  @IsString()
  @IsOptional()
  displayName?: string | null;
  @IsString()
  @IsOptional()
  externalDisplayName?: string | null;
  @IsNumber()
  @IsOptional()
  sortOrder?: number | null;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class RoleDTO implements Role {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  name!: string;
  @IsString()
  @IsOptional()
  displayName?: string | null;
  @IsNumber()
  @IsOptional()
  sortOrder?: number | null;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class ContactReasonDTO implements ContactReason {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  reason!: string;
  @IsString()
  @IsOptional()
  displayName?: string | null;
  @IsNumber()
  @IsOptional()
  sortOrder?: number | null;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class PhaseTransitionDTO implements PhaseTransition {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  targetPhaseId!: string;
  @IsString()
  @IsOptional()
  targetPhaseName?: string;
  @IsString()
  @IsOptional()
  targetPhaseDisplayName?: string;
  @IsString()
  @IsOptional()
  description?: string;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
}

export class PhaseDTO implements Phase {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  name!: string;
  @IsString()
  @IsOptional()
  displayName?: string;
  @IsString()
  @IsOptional()
  description?: string;
  @IsNumber()
  @IsOptional()
  phaseOrder?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedStatuses?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @TypeTransformer(() => PhaseTransitionDTO)
  transitions?: PhaseTransitionDTO[];
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class AttachmentPurposeDTO implements AttachmentPurpose {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  name!: string;
  @IsString()
  @IsOptional()
  displayName?: string | null;
  @IsNumber()
  @IsOptional()
  sortOrder?: number | null;
  @IsBoolean()
  @IsOptional()
  deprecated?: boolean;
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
}

export class MetadataResponseDTO implements MetadataResponse {
  /**
   * The app's SupportManagement namespace. Not part of the upstream metadata — added here because
   * the frontend needs it to derive schema names, and one config value beats mirroring it into a
   * second env file.
   */
  @IsOptional()
  @IsString()
  namespace?: string;
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => CategoryDTO)
  categories?: CategoryDTO[];
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => ExternalIdTypeDTO)
  externalIdTypes?: ExternalIdTypeDTO[];
  @IsOptional()
  @ValidateNested()
  @TypeTransformer(() => LabelsDTO)
  labels?: Labels;
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => StatusDTO)
  statuses?: StatusDTO[];
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => RoleDTO)
  roles?: RoleDTO[];
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => AttachmentPurposeDTO)
  attachmentPurposes?: AttachmentPurposeDTO[];
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => ContactReasonDTO)
  contactReasons?: ContactReasonDTO[];
  @IsOptional()
  @ValidateNested({ each: true })
  @TypeTransformer(() => PhaseDTO)
  phases?: PhaseDTO[];
}
