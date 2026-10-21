import type { OrganizationDTO, StakeholderDTO } from '@data-contracts/backend/data-contracts';

import { MOCK_COUNTRY_CODE_PHONE_NUMBER } from '../utils/constants';

export const ownerStakeholderFor = (organization: OrganizationDTO): StakeholderDTO => ({
  role: 'PRIMARY',
  externalId: organization.partyId,
  externalIdType: 'COMPANY',
  organizationName: organization.organizationName,
  organizationNumber: `${organization.organizationNumber.slice(0, 6)}-${organization.organizationNumber.slice(6)}`,
  address: 'Registrerad gata 5',
  zipCode: '85100',
  city: 'Sundsvall',
  country: 'SVERIGE',
  phoneNumbers: [MOCK_COUNTRY_CODE_PHONE_NUMBER],
});
