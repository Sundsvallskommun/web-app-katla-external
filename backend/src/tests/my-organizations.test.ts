// The picker in the registration form offers what this endpoint returns, and errands are scoped
// by the session list. They must be the same list, or a citizen can file an errand for an
// organisation the session does not carry and never read it back.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LegalEntityController } from '@/controllers/legal-entity.controller';
import { HttpException } from '@/exceptions/HttpException';
import { OrganizationDTO } from '@/responses/legal-entity.response';

import {
  mockCitizenPartyId,
  mockForeignOrganizationPartyId,
  mockOrganizationPartyId,
  mockSecondaryOrganizationPartyId,
  mockServiceKey,
} from './helpers/mock-data';

const { get } = vi.hoisted(() => ({ get: vi.fn<(config: { url: string }) => Promise<{ data: unknown }>>() }));

vi.mock('@/services/api.service', () => ({
  default: class {
    get = get;
  },
}));

const organization = (partyId: string): OrganizationDTO => ({
  partyId,
  organizationNumber: '1111112222',
  organizationName: `Org ${partyId}`,
  isAuthorizedSignatory: true,
});

const requestWithOrganizations = (organizations?: OrganizationDTO[]) =>
  ({
    user: { partyId: mockCitizenPartyId, personNumber: '199001011234' },
    headers: { 'x-service-key': mockServiceKey },
    session: { representingBusinessChoices: organizations && { [mockServiceKey]: organizations } },
  }) as never;

describe('my organizations', () => {
  it('returns the organizations the session was resolved with', () => {
    const organizations = [organization(mockOrganizationPartyId), organization(mockSecondaryOrganizationPartyId)];

    expect(new LegalEntityController().myOrganizations(requestWithOrganizations(organizations))).toEqual({ organizations });
  });

  it('returns an empty list for a citizen with no engagements', () => {
    expect(new LegalEntityController().myOrganizations(requestWithOrganizations([]))).toEqual({ organizations: [] });
  });

  // A failed lookup at login leaves the session without the list. Answering with an empty one
  // would read as "belongs to nothing", which is the same answer the errand endpoints refuse.
  it('fails closed when the session never got a list', () => {
    expect(() => new LegalEntityController().myOrganizations(requestWithOrganizations())).toThrow(HttpException);
  });

  describe('as a primary stakeholder', () => {
    const organizations = [organization(mockOrganizationPartyId), organization(mockSecondaryOrganizationPartyId)];

    beforeEach(() => {
      vi.clearAllMocks();
      get.mockResolvedValue({ data: { address: { addressArea: 'Storgatan 1', postalCode: '85230', city: 'Sundsvall' } } });
    });

    it('returns the organisation as the errand will file it: number and registered address included', async () => {
      const stakeholder = await new LegalEntityController().ownerStakeholder(requestWithOrganizations(organizations), mockOrganizationPartyId);

      expect(stakeholder).toEqual({
        role: 'PRIMARY',
        externalId: mockOrganizationPartyId,
        externalIdType: 'COMPANY',
        organizationName: `Org ${mockOrganizationPartyId}`,
        organizationNumber: '111111-2222',
        address: 'Storgatan 1',
        zipCode: '85230',
        city: 'Sundsvall',
        country: 'SVERIGE',
      });
    });

    it('does not resolve an organisation outside the session', async () => {
      await expect(
        new LegalEntityController().ownerStakeholder(requestWithOrganizations(organizations), mockForeignOrganizationPartyId),
      ).rejects.toMatchObject({ status: 404 });

      expect(get).not.toHaveBeenCalled();
    });
  });
});
