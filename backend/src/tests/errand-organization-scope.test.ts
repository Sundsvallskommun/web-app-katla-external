// Errands may only ever be fetched for the citizen themself and the organisations the session
// belongs to. The scope comes from the session, so these tests drive the controller directly
// with the session they want.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportManagementController } from '@/controllers/supportmanagement.controller';
import { ErrandsQueryDTO } from '@/responses/supportmanagement.response';

import {
  mockCitizenPartyId,
  mockErrandNumber,
  mockForeignOrganizationPartyId,
  mockMissingErrandNumber,
  mockOrganizationPartyId,
  mockSecondaryOrganizationPartyId,
} from './helpers/mock-data';

const { get } = vi.hoisted(() => ({ get: vi.fn<(config: { url: string }) => Promise<{ data: unknown }>>() }));

vi.mock('@/services/api.service', () => ({
  default: class {
    get = get;
    patch = vi.fn();
    post = vi.fn();
    put = vi.fn();
    delete = vi.fn();
  },
}));

const representing = (partyId: string) => ({ partyId, organizationNumber: `nr-${partyId}`, organizationName: `Org ${partyId}` });

const requestWithOrganizations = (organizationPartyIds?: string[]) =>
  ({ user: { partyId: mockCitizenPartyId }, session: { representingBusinessChoices: organizationPartyIds?.map(representing) } }) as never;

const asQuery = (query: Record<string, unknown>): ErrandsQueryDTO => query;
// Read the param back rather than decoding the raw URL: URLSearchParams encodes the spaces in
// `and`/`or` as '+', which decodeURIComponent leaves alone.
const requestedFilter = (call = 0): string => new URLSearchParams(get.mock.calls[call]?.[0].url.split('?')[1] ?? '').get('filter') ?? '';

describe('errand organization scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: { content: [], count: 0 } });
  });

  it('scopes the listing to the organisation in the session', async () => {
    await new SupportManagementController().getErrands(requestWithOrganizations([mockOrganizationPartyId]), asQuery({}));

    expect(requestedFilter()).toContain(`stakeholders.externalId:'${mockOrganizationPartyId}'`);
  });

  // A citizen may apply as a private person, with themself as the owner.
  it('scopes the listing to the citizen themself as well', async () => {
    await new SupportManagementController().getErrands(requestWithOrganizations([mockOrganizationPartyId]), asQuery({}));

    expect(requestedFilter()).toContain(`stakeholders.externalId:'${mockCitizenPartyId}'`);
  });

  it('drops an errand the citizen is only a contact on, even though the filter matched it', async () => {
    const own = { errandNumber: 'own', stakeholders: [{ role: 'PRIMARY', externalId: mockCitizenPartyId }] };
    const contactOnly = {
      errandNumber: 'contact',
      stakeholders: [
        { role: 'PRIMARY', externalId: mockForeignOrganizationPartyId },
        { role: 'CONTACT', externalId: mockCitizenPartyId },
      ],
    };
    get.mockResolvedValue({ data: { content: [own, contactOnly], totalElements: 2 } });

    const page = await new SupportManagementController().getErrands(requestWithOrganizations([mockOrganizationPartyId]), asQuery({}));

    expect(page.content).toEqual([own]);
  });

  it('keeps the organisation scope alongside a client filter', async () => {
    await new SupportManagementController().getErrands(requestWithOrganizations([mockOrganizationPartyId]), asQuery({ status: 'NEW' }));

    const filter = requestedFilter();
    expect(filter).toContain(`stakeholders.externalId:'${mockOrganizationPartyId}'`);
    expect(filter).toContain("status:'NEW'");
  });

  // Spring filter grammar: alternatives are an `or` group, terms are joined with `and`. A comma
  // is not an operator, so joining with one would not mean what it reads like.
  it('ORs the organisations together into one group', async () => {
    await new SupportManagementController().getErrands(
      requestWithOrganizations([mockOrganizationPartyId, mockSecondaryOrganizationPartyId]),
      asQuery({}),
    );

    expect(requestedFilter()).toContain(
      `(stakeholders.externalId:'${mockCitizenPartyId}' or stakeholders.externalId:'${mockOrganizationPartyId}' or stakeholders.externalId:'${mockSecondaryOrganizationPartyId}')`,
    );
  });

  it('ANDs a client filter onto the organisation group rather than widening it', async () => {
    await new SupportManagementController().getErrands(
      requestWithOrganizations([mockOrganizationPartyId, mockSecondaryOrganizationPartyId]),
      asQuery({ status: 'NEW' }),
    );

    expect(requestedFilter()).toBe(
      `(stakeholders.externalId:'${mockCitizenPartyId}' or stakeholders.externalId:'${mockOrganizationPartyId}' or stakeholders.externalId:'${mockSecondaryOrganizationPartyId}') and status:'NEW'`,
    );
  });

  it('refuses to fetch errands when the session carries no organisation', async () => {
    await expect(new SupportManagementController().getErrands(requestWithOrganizations(undefined), asQuery({}))).rejects.toMatchObject({
      status: 403,
    });

    expect(get).not.toHaveBeenCalled();
  });

  it('scopes a citizen without organisations to themself alone', async () => {
    await new SupportManagementController().getErrands(requestWithOrganizations([]), asQuery({}));

    expect(requestedFilter()).toBe(`(stakeholders.externalId:'${mockCitizenPartyId}')`);
  });

  it('rejects a client attempt to set the organisation scope itself', async () => {
    const query = asQuery({ 'stakeholders.externalId': mockForeignOrganizationPartyId });

    await expect(new SupportManagementController().getErrands(requestWithOrganizations([mockOrganizationPartyId]), query)).rejects.toMatchObject({
      status: 400,
    });

    expect(get).not.toHaveBeenCalled();
  });

  describe('reading one errand by errand number', () => {
    const errandOwnedBy = (partyId: string) => ({
      data: { content: [{ errandNumber: mockErrandNumber, stakeholders: [{ role: 'PRIMARY', externalId: partyId }] }] },
    });

    it('returns an errand whose primary stakeholder is one of the session organisations', async () => {
      get.mockResolvedValue(errandOwnedBy(mockOrganizationPartyId));

      const errand = await new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber);

      expect(errand.errandNumber).toBe(mockErrandNumber);
    });

    it('ANDs the errand number with the organisation group', async () => {
      get.mockResolvedValue(errandOwnedBy(mockOrganizationPartyId));

      await new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber);

      expect(requestedFilter()).toContain(
        `errandNumber:'${mockErrandNumber}' and (stakeholders.externalId:'${mockCitizenPartyId}' or stakeholders.externalId:'${mockOrganizationPartyId}')`,
      );
    });

    // Upstream leaves drafts out of a search unless the filter asks for lifecycle DRAFT itself.
    it('searches the drafts when no filed errand carries the number', async () => {
      get.mockResolvedValueOnce({ data: { content: [] } }).mockResolvedValueOnce(errandOwnedBy(mockOrganizationPartyId));

      const errand = await new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber);

      expect(errand.errandNumber).toBe(mockErrandNumber);
      expect(get).toHaveBeenCalledTimes(2);
      expect(requestedFilter(0)).not.toContain('lifecycle');
      expect(requestedFilter(1)).toBe(
        `errandNumber:'${mockErrandNumber}' and (stakeholders.externalId:'${mockCitizenPartyId}' or stakeholders.externalId:'${mockOrganizationPartyId}') and lifecycle:'DRAFT'`,
      );
    });

    it('leaves the drafts alone once a filed errand matches', async () => {
      get.mockResolvedValue(errandOwnedBy(mockOrganizationPartyId));

      await new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber);

      expect(get).toHaveBeenCalledTimes(1);
    });

    it('answers 404 when neither search matches', async () => {
      get.mockResolvedValue({ data: { content: [] } });

      await expect(
        new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber),
      ).rejects.toMatchObject({ status: 404 });
      expect(get).toHaveBeenCalledTimes(2);
    });

    // The upstream filter should already exclude this. The check must not depend on that.
    it('hides an errand whose primary stakeholder is another organisation, even if upstream returns it', async () => {
      get.mockResolvedValue(errandOwnedBy(mockForeignOrganizationPartyId));

      await expect(
        new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it('returns an errand the citizen owns as a private person', async () => {
      get.mockResolvedValue(errandOwnedBy(mockCitizenPartyId));

      const errand = await new SupportManagementController().getErrand(requestWithOrganizations([]), mockErrandNumber);

      expect(errand.errandNumber).toBe(mockErrandNumber);
    });

    it('hides an errand the citizen is only a contact on', async () => {
      get.mockResolvedValue({
        data: {
          content: [
            {
              errandNumber: mockErrandNumber,
              stakeholders: [
                { role: 'PRIMARY', externalId: mockForeignOrganizationPartyId },
                { role: 'CONTACT', externalId: mockCitizenPartyId },
              ],
            },
          ],
        },
      });

      await expect(
        new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('hides an errand that has no primary stakeholder at all', async () => {
      get.mockResolvedValue({
        data: { content: [{ errandNumber: mockErrandNumber, stakeholders: [{ role: 'CONTACT', externalId: mockOrganizationPartyId }] }] },
      });

      await expect(
        new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockErrandNumber),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it('reports a missing errand the same way as one belonging to another organisation', async () => {
      get.mockResolvedValue({ data: { content: [] } });

      await expect(
        new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), mockMissingErrandNumber),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it('refuses to read an errand when the session carries no organisation', async () => {
      await expect(new SupportManagementController().getErrand(requestWithOrganizations(undefined), mockErrandNumber)).rejects.toMatchObject({
        status: 403,
      });

      expect(get).not.toHaveBeenCalled();
    });

    it('rejects an errand number that would break out of the upstream filter literal', async () => {
      await expect(
        new SupportManagementController().getErrand(requestWithOrganizations([mockOrganizationPartyId]), "ABC' or status:'NEW"),
      ).rejects.toMatchObject({
        status: 400,
      });

      expect(get).not.toHaveBeenCalled();
    });
  });

  it('applies the same rules to the count endpoint', async () => {
    await expect(new SupportManagementController().getNumberOfErrands(requestWithOrganizations(undefined), asQuery({}))).rejects.toMatchObject({
      status: 403,
    });

    get.mockResolvedValue({ data: { count: 2 } });
    await new SupportManagementController().getNumberOfErrands(requestWithOrganizations([mockOrganizationPartyId]), asQuery({}));

    expect(requestedFilter()).toContain(`stakeholders.externalId:'${mockOrganizationPartyId}'`);
  });
});
