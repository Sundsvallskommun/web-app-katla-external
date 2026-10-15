// The citizen's organisations decide which errands they may see, so the two engagement sources
// (own engagements, and mandates granted to them) both have to land in the list, deduped, each
// resolved to the party id an errand carries as its primary stakeholder.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ApiService from '@/services/api.service';
import { getMyOrganizations } from '@/services/legal-entity.service';

import {
  mockCitizenPartyId,
  mockGrantorPartyId,
  mockMunicipalityId,
  mockOrganizationName,
  mockOrganizationNumber,
  mockOrganizationPartyId,
  mockPersonNumber,
  mockSecondaryOrganizationName,
  mockSecondaryOrganizationNumber,
  mockSecondaryOrganizationPartyId,
  mockServiceKey,
  mockUnresolvableOrganizationNumber,
} from './helpers/mock-data';

const req = { user: { partyId: mockCitizenPartyId } } as never;

/** The organisations resolved for the one configured form. */
const organizationsFor = async (api: Pick<ApiService, 'get'>) =>
  (await getMyOrganizations(mockPersonNumber, mockCitizenPartyId, req, api))[mockServiceKey] ?? [];

/** Routes a request to a canned response by URL fragment, so order of calls does not matter. */
const apiReturning = (routes: { match: string; response: { data: unknown } | Error }[]) =>
  ({
    get: vi.fn((config: { url: string }) => {
      const route = routes.find(candidate => config.url.includes(candidate.match));
      if (!route) return Promise.reject(new Error(`unstubbed url: ${config.url}`));
      if (route.response instanceof Error) return Promise.reject(route.response);
      return Promise.resolve({ ...route.response, message: 'success' });
    }),
  }) as unknown as Pick<ApiService, 'get'>;

const noMandates = { match: '/mandates', response: { data: { mandateDetailsList: [] } } };
const mandateFromGrantor = {
  match: '/mandates',
  response: { data: { mandateDetailsList: [{ grantorDetails: { grantorPartyId: mockGrantorPartyId } }] } },
};
const grantorIsOrganization = (organizationNumber: string, name: string) => ({
  match: `legalentity/2.0/${mockMunicipalityId}/${mockGrantorPartyId}`,
  response: { data: { organizationNumber, name } },
});
const guidFor = (organizationNumber: string, partyId: string) => ({ match: `${organizationNumber}/guid`, response: { data: partyId } });

describe('getMyOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves each engagement to the party id errands are scoped by', async () => {
    const api = apiReturning([
      {
        match: 'engagements/person',
        response: { data: [{ organizationNumber: mockOrganizationNumber, name: mockOrganizationName, isAuthorizedSignatory: true }] },
      },
      noMandates,
      guidFor(mockOrganizationNumber, mockOrganizationPartyId),
    ]);

    const organizations = await organizationsFor(api);

    expect(organizations).toEqual([
      {
        partyId: mockOrganizationPartyId,
        organizationNumber: mockOrganizationNumber,
        organizationName: mockOrganizationName,
        isAuthorizedSignatory: true,
      },
    ]);
  });

  it('includes organisations that granted the citizen a mandate', async () => {
    const api = apiReturning([
      { match: 'engagements/person', response: { data: [] } },
      mandateFromGrantor,
      grantorIsOrganization(mockSecondaryOrganizationNumber, mockSecondaryOrganizationName),
      guidFor(mockSecondaryOrganizationNumber, mockSecondaryOrganizationPartyId),
    ]);

    const organizations = await organizationsFor(api);

    expect(organizations).toEqual([
      {
        partyId: mockSecondaryOrganizationPartyId,
        organizationNumber: mockSecondaryOrganizationNumber,
        organizationName: mockSecondaryOrganizationName,
        isAuthorizedSignatory: false,
      },
    ]);
  });

  it('lists an organisation once when it is both an engagement and a mandate', async () => {
    const api = apiReturning([
      {
        match: 'engagements/person',
        response: { data: [{ organizationNumber: mockOrganizationNumber, name: mockOrganizationName, isAuthorizedSignatory: true }] },
      },
      mandateFromGrantor,
      grantorIsOrganization(mockOrganizationNumber, mockOrganizationName),
      guidFor(mockOrganizationNumber, mockOrganizationPartyId),
    ]);

    const organizations = await organizationsFor(api);

    expect(organizations).toHaveLength(1);
    // The citizen's own engagement wins, so the signatory flag is not lost to the mandate copy.
    expect(organizations[0]?.isAuthorizedSignatory).toBe(true);
  });

  it('keeps the other organisations when one party id cannot be resolved', async () => {
    const api = apiReturning([
      {
        match: 'engagements/person',
        response: {
          data: [
            { organizationNumber: mockOrganizationNumber, name: mockOrganizationName },
            { organizationNumber: mockUnresolvableOrganizationNumber, name: mockSecondaryOrganizationName },
          ],
        },
      },
      noMandates,
      { match: `${mockUnresolvableOrganizationNumber}/guid`, response: new Error('no guid') },
      guidFor(mockOrganizationNumber, mockOrganizationPartyId),
    ]);

    const organizations = await organizationsFor(api);

    expect(organizations.map(organization => organization.organizationNumber)).toEqual([mockOrganizationNumber]);
  });

  it('still returns the mandate organisations when the engagements call fails', async () => {
    const api = apiReturning([
      { match: 'engagements/person', response: new Error('LegalEntity down') },
      mandateFromGrantor,
      grantorIsOrganization(mockSecondaryOrganizationNumber, mockSecondaryOrganizationName),
      guidFor(mockSecondaryOrganizationNumber, mockSecondaryOrganizationPartyId),
    ]);

    const organizations = await organizationsFor(api);

    expect(organizations.map(organization => organization.organizationNumber)).toEqual([mockSecondaryOrganizationNumber]);
  });

  it('returns nothing rather than throwing when both sources fail', async () => {
    const api = apiReturning([
      { match: 'engagements/person', response: new Error('LegalEntity down') },
      { match: '/mandates', response: new Error('MyRepresentatives down') },
    ]);

    await expect(organizationsFor(api)).resolves.toEqual([]);
  });

  it('scopes mandates to the form whose namespace granted them, while engagements apply to every form', async () => {
    const api = apiReturning([
      {
        match: 'engagements/person',
        response: { data: [{ organizationNumber: mockOrganizationNumber, name: mockOrganizationName, isAuthorizedSignatory: true }] },
      },
      { match: '/first-namespace/mandates', response: { data: { mandateDetailsList: [] } } },
      { match: '/second-namespace/mandates', response: mandateFromGrantor.response },
      grantorIsOrganization(mockSecondaryOrganizationNumber, mockSecondaryOrganizationName),
      guidFor(mockOrganizationNumber, mockOrganizationPartyId),
      guidFor(mockSecondaryOrganizationNumber, mockSecondaryOrganizationPartyId),
    ]);
    const services = new Map([
      ['first', 'first-namespace'],
      ['second', 'second-namespace'],
    ]);

    const organizations = await getMyOrganizations(mockPersonNumber, mockCitizenPartyId, req, api, services);

    expect(organizations.first?.map(organization => organization.partyId)).toEqual([mockOrganizationPartyId]);
    expect(organizations.second?.map(organization => organization.partyId)).toEqual([mockOrganizationPartyId, mockSecondaryOrganizationPartyId]);
  });

  it('skips an engagement with no organisation number', async () => {
    const api = apiReturning([{ match: 'engagements/person', response: { data: [{ name: mockOrganizationName }] } }, noMandates]);

    await expect(organizationsFor(api)).resolves.toEqual([]);
  });
});
