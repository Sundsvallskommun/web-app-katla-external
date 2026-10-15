import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

/** One organisation the logged-in citizen has an engagement in. */
export class OrganizationDTO {
  /** LegalEntity guid. The same id an errand carries as its primary stakeholder externalId. */
  @IsString()
  partyId!: string;

  @IsString()
  organizationNumber!: string;

  @IsString()
  organizationName!: string;

  @IsBoolean()
  @IsOptional()
  isAuthorizedSignatory?: boolean;
}

export class MyOrganizationsDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrganizationDTO)
  organizations!: OrganizationDTO[];
}
