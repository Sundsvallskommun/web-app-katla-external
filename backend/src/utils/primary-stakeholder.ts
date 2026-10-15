import { Parameter, Stakeholder } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { RequestWithUser } from '@/interfaces/auth.interface';
import { OrganizationDTO } from '@/responses/legal-entity.response';
import ApiService from '@/services/api.service';
import { getOrganizationAddress } from '@/services/legal-entity.service';
import { logger } from '@/utils/logger';
import { requireServiceKey } from '@/utils/service-context';
import { ORGANIZATION_NUMBER_PARAMETER } from '@/utils/stakeholder-mapping';

const PRIMARY_STAKEHOLDER_ROLE = 'PRIMARY';
const ORGANIZATION_EXTERNAL_ID_TYPE = 'COMPANY';
const COUNTRY = 'SVERIGE';

type AddressLookup = Pick<ApiService, 'get'>;

const isPrimaryStakeholder = (stakeholder: Stakeholder): boolean => stakeholder.role === PRIMARY_STAKEHOLDER_ROLE;

export const primaryStakeholderFor = (organization: OrganizationDTO): Stakeholder => ({
  role: PRIMARY_STAKEHOLDER_ROLE,
  externalId: organization.partyId,
  externalIdType: ORGANIZATION_EXTERNAL_ID_TYPE,
  organizationName: organization.organizationName,
});

/** Draken's format: NNNNNN-NNNN. */
const formatOrganizationNumber = (organizationNumber: string): string => {
  const digits = organizationNumber.replace(/\D/g, '');

  return digits.length === 10 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : organizationNumber;
};

const withOrganizationNumber = (parameters: Parameter[] | undefined, organizationNumber: string): Parameter[] => [
  ...(parameters ?? []).filter(parameter => parameter.key !== ORGANIZATION_NUMBER_PARAMETER),
  { key: ORGANIZATION_NUMBER_PARAMETER, displayName: 'Organisationsnummer', values: [formatOrganizationNumber(organizationNumber)] },
];

const filled = (value: string | null | undefined): string | undefined => (value?.trim() ? value : undefined);

const hasAddress = (stakeholder: Stakeholder): boolean =>
  Boolean(filled(stakeholder.address) && filled(stakeholder.zipCode) && filled(stakeholder.city));

const completePrimaryStakeholder = async (stakeholder: Stakeholder, req: RequestWithUser, api?: AddressLookup): Promise<Stakeholder> => {
  const partyId = stakeholder.externalId?.toLowerCase();
  const organization = req.session.representingBusinessChoices?.[requireServiceKey(req)]?.find(
    candidate => candidate.partyId.toLowerCase() === partyId,
  );

  const completed: Stakeholder = {
    ...stakeholder,
    country: filled(stakeholder.country) ?? COUNTRY,
    ...(organization && { parameters: withOrganizationNumber(stakeholder.parameters, organization.organizationNumber) }),
  };

  if (!organization || hasAddress(completed)) return completed;

  // Best effort.
  try {
    const registered = await getOrganizationAddress(organization.partyId, req, api);
    if (!registered) return completed;

    return {
      ...completed,
      address: filled(completed.address) ?? registered.address,
      zipCode: filled(completed.zipCode) ?? registered.zipCode,
      city: filled(completed.city) ?? registered.city,
    };
  } catch (error) {
    logger.warn(`Could not read the address for organization ${organization.partyId}; filing the errand without it`);
    logger.debug(error);
    return completed;
  }
};

/**
 * Adds the organisation number (session) and registered address (LegalEntity) Draken expects on
 * the owner. Runs on every write, since the DTO carries no parameters.
 */
export const completePrimaryStakeholders = (
  stakeholders: Stakeholder[] | undefined,
  req: RequestWithUser,
  api?: AddressLookup,
): Promise<Stakeholder[] | undefined> | undefined =>
  stakeholders &&
  Promise.all(
    stakeholders.map(stakeholder =>
      isPrimaryStakeholder(stakeholder) ? completePrimaryStakeholder(stakeholder, req, api) : Promise.resolve(stakeholder),
    ),
  );
