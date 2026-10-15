/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface OrganizationDTO {
  partyId: string;
  organizationNumber: string;
  organizationName: string;
  isAuthorizedSignatory?: boolean;
}

export interface MyOrganizationsDTO {
  organizations: OrganizationDTO[];
}

export interface ErrandCountDTO {
  count: number;
}

export interface ErrandsQueryDTO {
  page?: number;
  size?: number;
  sort?: string;
  status?: string;
  lifecycle?: "DRAFT" | "ACTIVE";
}

export interface StakeholderDTO {
  externalId?: string;
  personNumber?: string;
  externalIdType?: string;
  role?: string;
  city?: string;
  organizationName?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  careOf?: string;
  zipCode?: string;
  country?: string;
  emails?: string[];
  phoneNumbers?: string[];
  title?: string;
  department?: string;
  serveringsstalle?: string;
  organizationNumber?: string;
}

export interface ClassificationDTO {
  category?: string;
  type?: string;
}

export interface ParameterDTO {
  key: string;
  displayName?: string;
  group?: string;
  values?: string[];
  version?: number;
}

export interface ExternalTagDTO {
  key: string;
  value: string;
}

export interface JsonParameterDTO {
  key: string;
  value: any;
  schemaId: string;
}

export interface ErrandLabelDTO {
  id?: string;
  classification?: string;
  displayName?: string;
  resourcePath?: string;
  resourceName?: string;
}

export interface ErrandActionDTO {
  id?: string;
  actionName?: string;
  executeAfter?: string;
  actionConfigId?: string;
  displayValue?: string;
}

export interface ErrandPhaseDTO {
  phaseId?: string;
  name?: string;
  displayName?: string;
  started?: string;
  ended?: string;
}

export interface ErrandDTO {
  id?: string;
  errandNumber?: string;
  title?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  stakeholders?: StakeholderDTO[];
  externalTags?: ExternalTagDTO[];
  parameters?: ParameterDTO[];
  jsonParameters?: JsonParameterDTO[];
  classification?: ClassificationDTO;
  status?: string;
  lifecycle?: "DRAFT" | "ACTIVE";
  resolution?: string;
  description?: string;
  channel?: string;
  reporterUserId?: string;
  assignedUserId?: string;
  assignedGroupId?: string;
  escalationEmail?: string;
  contactReason?: string;
  contactReasonDescription?: string;
  businessRelated?: boolean;
  created?: string;
  modified?: string;
  touched?: string;
  labels?: ErrandLabelDTO[];
  phases?: ErrandPhaseDTO[];
  activePhaseId?: string;
  actions?: ErrandActionDTO[];
  version?: number;
}

export interface SortObjectDTO {
  sorted?: boolean;
  empty?: boolean;
  unsorted?: boolean;
}

export interface PageableObjectDTO {
  paged?: boolean;
  pageNumber?: number;
  pageSize?: number;
  offset?: number;
  sort?: SortObjectDTO;
  unpaged?: boolean;
}

export interface PageErrandDTO {
  totalElements?: number;
  totalPages?: number;
  pageable?: PageableObjectDTO;
  size?: number;
  content?: ErrandDTO[];
  number?: number;
  sort?: SortObjectDTO;
  numberOfElements?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}

export interface SchemaResponseDTO {
  schema: object;
  uiSchema: object;
  schemaId: string;
  name?: string;
  version?: string;
}

export interface TypeDTO {
  name: string;
  displayName?: string;
  escalationEmail?: string;
  deprecated?: boolean;
  created?: string;
  modified?: string;
}

export interface CategoryDTO {
  id?: string;
  name?: string;
  displayName?: string;
  sortOrder?: number;
  deprecated?: boolean;
  types?: TypeDTO[];
  created?: string;
  modified?: string;
}

export interface ExternalIdTypeDTO {
  id?: string;
  name: string;
  displayName?: string;
  sortOrder?: number;
  deprecated?: boolean;
  created?: string;
  modified?: string;
}

export interface LabelAttributeDTO {
  key: string;
  value: string;
}

export interface LabelDTO {
  id?: string;
  classification: string;
  displayName?: string;
  resourcePath?: string;
  resourceName: string;
  deprecated?: boolean;
  labels?: LabelDTO[];
  attributes?: LabelAttributeDTO[];
}

export interface LabelsDTO {
  labelStructure?: LabelDTO[];
}

export interface StatusDTO {
  id?: string;
  name: string;
  displayName?: string;
  externalDisplayName?: string;
  sortOrder?: number;
  deprecated?: boolean;
  created?: string;
  modified?: string;
}

export interface RoleDTO {
  id?: string;
  name: string;
  displayName?: string;
  sortOrder?: number;
  deprecated?: boolean;
  created?: string;
  modified?: string;
}

export interface ContactReasonDTO {
  id?: string;
  reason: string;
  displayName?: string;
  sortOrder?: number;
  deprecated?: boolean;
  created?: string;
  modified?: string;
}

export interface PhaseTransitionDTO {
  id?: string;
  targetPhaseId: string;
  targetPhaseName?: string;
  targetPhaseDisplayName?: string;
  description?: string;
  deprecated?: boolean;
}

export interface PhaseDTO {
  id?: string;
  name: string;
  displayName?: string;
  description?: string;
  phaseOrder?: number;
  allowedStatuses?: string[];
  transitions?: PhaseTransitionDTO[];
  deprecated?: boolean;
  created?: string;
  modified?: string;
}

export interface AttachmentPurposeDTO {
  id?: string;
  name: string;
  displayName?: string;
  sortOrder?: number;
  deprecated?: boolean;
  created?: string;
  modified?: string;
}

export interface MetadataResponseDTO {
  namespace?: string;
  categories?: CategoryDTO[];
  externalIdTypes?: ExternalIdTypeDTO[];
  labels?: LabelsDTO;
  statuses?: StatusDTO[];
  roles?: RoleDTO[];
  attachmentPurposes?: AttachmentPurposeDTO[];
  contactReasons?: ContactReasonDTO[];
  phases?: PhaseDTO[];
}

export interface ErrandAttachmentPurposeDTO {
  id?: string;
  name?: string;
  displayName?: string;
}

export interface ErrandAttachmentDTO {
  id: string;
  fileName: string;
  mimeType?: string;
  created?: string;
  purpose?: ErrandAttachmentPurposeDTO;
}

export interface CreateErrandAttachmentDTO {
  category?: string;
}

export interface UpdateErrandAttachmentDTO {
  /** @minLength 1 */
  category: string;
}

export interface User {
  name: string;
  initials: string;
}

export interface UserApiResponse {
  data: User;
  message: string;
}
