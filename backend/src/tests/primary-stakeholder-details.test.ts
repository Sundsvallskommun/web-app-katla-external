import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Stakeholder } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { RequestWithUser } from '@/interfaces/auth.interface';
import { completePrimaryStakeholders } from '@/utils/primary-stakeholder';

import { mockCitizenPartyId, mockOrganizationName, mockOrganizationPartyId, mockPhoneNumber, mockServiceKey } from './helpers/mock-data';

vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), debug: vi.fn() } }));

const get = vi.fn<(config: { url: string }) => Promise<{ data: unknown }>>();
const api = { get } as never;

const req = {
  user: { partyId: mockCitizenPartyId },
  headers: { 'x-service-key': mockServiceKey },
  session: {
    representingBusinessChoices: {
      [mockServiceKey]: [{ partyId: mockOrganizationPartyId, organizationNumber: '1111112222', organizationName: mockOrganizationName }],
    },
  },
} as unknown as RequestWithUser;

const owner = (overrides: Partial<Stakeholder> = {}): Stakeholder => ({
  role: 'PRIMARY',
  externalId: mockOrganizationPartyId,
  externalIdType: 'COMPANY',
  organizationName: mockOrganizationName,
  parameters: [{ key: 'serveringsstalle', values: ['Selånger Padelcenter'] }],
  ...overrides,
});

const registeredAddress = { addressArea: 'TRANSPORTGATAN 36', postalCode: '42246', city: 'HISINGS BACKA' };
const registeredPhone = mockPhoneNumber;
const phoneChannel = (value: string) => ({ type: 'phone', value });

const organizationNumberParameter = { key: 'organizationNumber', displayName: 'Organisationsnummer', values: ['111111-2222'] };

const complete = async (stakeholder: Stakeholder): Promise<Stakeholder> => {
  const [completed] = (await completePrimaryStakeholders([stakeholder], req, api)) ?? [];
  if (!completed) throw new Error('No stakeholder returned');
  return completed;
};

describe('primary stakeholder details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: { address: registeredAddress, phoneNumber: registeredPhone } });
  });

  it('files the organisation number from the session as a parameter, hyphenated as Draken does', async () => {
    const completed = await complete(owner());

    expect(completed.parameters).toEqual([{ key: 'serveringsstalle', values: ['Selånger Padelcenter'] }, organizationNumberParameter]);
  });

  it('fills the registered address and phone from LegalEntity', async () => {
    const completed = await complete(owner());

    expect(get.mock.calls[0]?.[0].url).toContain(`/${mockOrganizationPartyId}`);
    expect(completed).toMatchObject({
      address: 'TRANSPORTGATAN 36',
      zipCode: '42246',
      city: 'HISINGS BACKA',
      country: 'SVERIGE',
      contactChannels: [phoneChannel(registeredPhone)],
    });
  });

  it('keeps the address and phone the citizen entered and skips the lookup', async () => {
    const entered = { address: 'Storgatan 1', zipCode: '85230', city: 'Sundsvall', contactChannels: [phoneChannel('+46701234567')] };

    const completed = await complete(owner(entered));

    expect(completed).toMatchObject(entered);
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps the entered address and takes only the phone from LegalEntity', async () => {
    const entered = { address: 'Storgatan 1', zipCode: '85230', city: 'Sundsvall', contactChannels: [{ type: 'email', value: 'post@acme.se' }] };

    const completed = await complete(owner(entered));

    expect(completed).toMatchObject({ ...entered, contactChannels: [{ type: 'email', value: 'post@acme.se' }, phoneChannel(registeredPhone)] });
  });

  it('keeps the entered phone and takes only the address from LegalEntity', async () => {
    const completed = await complete(owner({ contactChannels: [phoneChannel('+46701234567')] }));

    expect(completed).toMatchObject({ address: 'TRANSPORTGATAN 36', contactChannels: [phoneChannel('+46701234567')] });
  });

  it('files no phone when LegalEntity holds none', async () => {
    get.mockResolvedValue({ data: { address: registeredAddress, phoneNumber: ' ' } });

    const completed = await complete(owner());

    expect(completed.address).toBe('TRANSPORTGATAN 36');
    expect(completed.contactChannels).toBeUndefined();
  });

  it('files the errand without address or phone when LegalEntity cannot be read', async () => {
    get.mockRejectedValue(new Error('upstream down'));

    const completed = await complete(owner());

    expect(completed.address).toBeUndefined();
    expect(completed.contactChannels).toBeUndefined();
    expect(completed.parameters).toContainEqual(organizationNumberParameter);
  });

  it('leaves an owner outside the session organisations without a number', async () => {
    const foreign = owner({ externalId: '99999999-8888-4777-8666-555555555555' });

    const completed = await complete(foreign);

    expect(completed.parameters).toEqual(foreign.parameters);
    expect(get).not.toHaveBeenCalled();
  });

  it('matches the session organisation regardless of party id casing', async () => {
    const completed = await complete(owner({ externalId: mockOrganizationPartyId.toUpperCase() }));

    expect(completed.parameters).toContainEqual(organizationNumberParameter);
  });

  it('leaves other stakeholders untouched', async () => {
    const reporter: Stakeholder = { role: 'REPORTER', externalIdType: 'PRIVATE', firstName: 'Anna', lastName: 'Andersson' };

    const completed = await completePrimaryStakeholders([reporter, owner()], req, api);

    expect(completed?.[0]).toBe(reporter);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('passes undefined through', async () => {
    expect(await completePrimaryStakeholders(undefined, req, api)).toBeUndefined();
  });
});
