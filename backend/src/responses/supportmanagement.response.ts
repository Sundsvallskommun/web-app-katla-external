import { Type } from 'class-transformer';
import { Allow, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

import {
  Classification,
  CountResponse,
  Errand,
  ErrandAction,
  ErrandLabel,
  ErrandLifecycleEnum,
  ErrandPhase,
  ExternalTag,
  JsonNode,
  JsonParameter,
  PageableObject,
  PageErrand,
  Parameter,
  Priority,
  SortObject,
  Stakeholder,
} from '@/data-contracts/support-management-alkt-sprint/data-contracts';

export class ErrandCountDTO implements CountResponse {
  @IsNumber()
  count!: number;
}

export class ErrandsQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  size?: number;
  @IsOptional()
  @IsString()
  sort?: string;
  @IsOptional()
  @IsString()
  status?: string;
  // Upstream omits drafts unless the filter names lifecycle. Declared as string: routing-controllers
  // binds query fields by design:type, and an enum type makes it JSON-parse the raw value.
  @IsOptional()
  @IsEnum(ErrandLifecycleEnum)
  lifecycle?: string;
}

export class StakeholderDTO implements Partial<Stakeholder> {
  @IsString()
  @IsOptional()
  externalId?: string;
  @IsString()
  @IsOptional()
  personNumber?: string;
  @IsString()
  @IsOptional()
  externalIdType?: string;
  @IsString()
  @IsOptional()
  role?: string;
  @IsString()
  @IsOptional()
  city?: string;
  @IsString()
  @IsOptional()
  organizationName?: string;
  @IsString()
  @IsOptional()
  firstName?: string;
  @IsString()
  @IsOptional()
  lastName?: string;
  @IsString()
  @IsOptional()
  address?: string;
  @IsString()
  @IsOptional()
  careOf?: string;
  @IsString()
  @IsOptional()
  zipCode?: string;
  @IsString()
  @IsOptional()
  country?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emails?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[];
  @IsString()
  @IsOptional()
  title?: string;
  @IsString()
  @IsOptional()
  department?: string;
  /**
   * The serving location the errand concerns. Carried in the stakeholder's parameters upstream;
   * a free-text name for now, to become an id once the serveringsställe service exists.
   */
  @IsString()
  @IsOptional()
  serveringsstalle?: string;
  /** Read only: resolved server side on write. */
  @IsString()
  @IsOptional()
  organizationNumber?: string;
  // /** Parameters for the stakeholder */
  // parameters?: Parameter[];
}

export class ClassificationDTO implements Classification {
  @IsString()
  @IsOptional()
  category?: string;
  @IsString()
  @IsOptional()
  type?: string;
}

export class ParameterDTO implements Parameter {
  @IsString()
  key!: string;
  @IsString()
  @IsOptional()
  displayName?: string;
  @IsString()
  @IsOptional()
  group?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];
  @IsNumber()
  @IsOptional()
  version?: number;
}

export class ExternalTagDTO implements ExternalTag {
  @IsString()
  key!: string;
  @IsString()
  value!: string;
}

export class JsonParameterDTO implements JsonParameter {
  @IsString()
  key!: string;
  // Arbitrary JSON, so no validator constrains it — but without a decorator the property is
  // absent from the generated schema and the frontend contract loses the field entirely.
  @Allow()
  value!: JsonNode;
  @IsString()
  schemaId!: string;
}

export class ErrandLabelDTO implements ErrandLabel {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  @IsOptional()
  classification?: string;
  @IsString()
  @IsOptional()
  displayName?: string;
  @IsString()
  @IsOptional()
  resourcePath?: string;
  @IsString()
  @IsOptional()
  resourceName?: string;
}

export class ErrandActionDTO implements ErrandAction {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  @IsOptional()
  actionName?: string;
  @IsString()
  @IsOptional()
  executeAfter?: string;
  @IsString()
  @IsOptional()
  actionConfigId?: string;
  @IsString()
  @IsOptional()
  displayValue?: string;
}

export class ErrandPhaseDTO implements ErrandPhase {
  @IsString()
  @IsOptional()
  phaseId?: string;
  @IsString()
  @IsOptional()
  name?: string;
  @IsString()
  @IsOptional()
  displayName?: string;
  @IsString()
  @IsOptional()
  started?: string;
  @IsString()
  @IsOptional()
  ended?: string;
}

export class ErrandDTO implements Errand {
  @IsString()
  @IsOptional()
  id?: string;
  @IsString()
  @IsOptional()
  errandNumber?: string;
  @IsString()
  @IsOptional()
  title?: string;
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StakeholderDTO)
  stakeholders?: StakeholderDTO[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalTagDTO)
  externalTags?: ExternalTag[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDTO)
  parameters?: Parameter[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsonParameterDTO)
  jsonParameters?: JsonParameterDTO[];
  @IsOptional()
  @ValidateNested()
  @Type(() => ClassificationDTO)
  classification?: ClassificationDTO;
  @IsString()
  @IsOptional()
  status?: string;
  @IsEnum(ErrandLifecycleEnum)
  @IsOptional()
  lifecycle?: ErrandLifecycleEnum;
  @IsString()
  @IsOptional()
  resolution?: string;
  @IsString()
  @IsOptional()
  description?: string;
  @IsString()
  @IsOptional()
  channel?: string;
  @IsString()
  @IsOptional()
  reporterUserId?: string;
  @IsString()
  @IsOptional()
  assignedUserId?: string;
  @IsString()
  @IsOptional()
  assignedGroupId?: string;
  @IsString()
  @IsOptional()
  escalationEmail?: string;
  @IsString()
  @IsOptional()
  contactReason?: string;
  @IsString()
  @IsOptional()
  contactReasonDescription?: string;
  //   /** Suspension information */
  //   suspension?: Suspension;
  @IsBoolean()
  @IsOptional()
  businessRelated?: boolean;
  /** List of active notifications for the errand */
  //   activeNotifications?: Notification[];
  @IsString()
  @IsOptional()
  created?: string;
  @IsString()
  @IsOptional()
  modified?: string;
  @IsString()
  @IsOptional()
  touched?: string;
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ErrandLabelDTO)
  labels?: ErrandLabelDTO[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErrandPhaseDTO)
  phases?: ErrandPhaseDTO[];
  @IsString()
  @IsOptional()
  activePhaseId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErrandActionDTO)
  actions?: ErrandActionDTO[];
  @IsNumber()
  @IsOptional()
  version?: number;
}

class SortObjectDTO implements SortObject {
  @IsBoolean()
  @IsOptional()
  sorted?: boolean;
  @IsBoolean()
  @IsOptional()
  empty?: boolean;
  @IsBoolean()
  @IsOptional()
  unsorted?: boolean;
}

class PageableObjectDTO implements PageableObject {
  @IsBoolean()
  @IsOptional()
  paged?: boolean;
  @IsNumber()
  @IsOptional()
  pageNumber?: number;
  @IsNumber()
  @IsOptional()
  pageSize?: number;
  @IsNumber()
  @IsOptional()
  offset?: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => SortObjectDTO)
  sort?: SortObjectDTO;
  @IsBoolean()
  @IsOptional()
  unpaged?: boolean;
}

export class PageErrandDTO implements PageErrand {
  @IsNumber()
  @IsOptional()
  totalElements?: number;
  @IsNumber()
  @IsOptional()
  totalPages?: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => PageableObjectDTO)
  pageable?: PageableObjectDTO;
  @IsNumber()
  @IsOptional()
  size?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErrandDTO)
  @IsOptional()
  content?: ErrandDTO[];
  @IsNumber()
  @IsOptional()
  number?: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => SortObjectDTO)
  sort?: SortObjectDTO;
  @IsNumber()
  @IsOptional()
  numberOfElements?: number;
  @IsBoolean()
  @IsOptional()
  first?: boolean;
  @IsBoolean()
  @IsOptional()
  last?: boolean;
  @IsBoolean()
  @IsOptional()
  empty?: boolean;
}
