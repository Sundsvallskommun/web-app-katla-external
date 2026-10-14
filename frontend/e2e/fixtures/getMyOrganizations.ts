import type { MyOrganizationsDTO, OrganizationDTO } from '@data-contracts/backend/data-contracts';

export const mockOrganization: OrganizationDTO = {
  partyId: 'f1e2d3c4-0000-4000-8000-000000000001',
  organizationNumber: '1111112222',
  organizationName: 'Acme Restaurang AB',
  isAuthorizedSignatory: true,
};

export const mockSecondOrganization: OrganizationDTO = {
  partyId: 'f1e2d3c4-0000-4000-8000-000000000002',
  organizationNumber: '2222223333',
  organizationName: 'Bolaget Krog HB',
  isAuthorizedSignatory: false,
};

// Two organisations so the picker has a choice to make.
export const getMyOrganizations: MyOrganizationsDTO = {
  organizations: [mockOrganization, mockSecondOrganization],
};
