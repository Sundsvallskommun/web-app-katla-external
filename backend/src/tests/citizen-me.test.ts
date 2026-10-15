// The logged in citizen is resolved from the session's party id, never from a caller-supplied
// identifier, so the endpoint can only ever hand back the caller's own details.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CitizenController } from '@/controllers/citizen.controller';
import { RequestWithUser } from '@/interfaces/auth.interface';

import {
  mockCitizenPartyId,
  mockFirstName,
  mockLastName,
  mockMunicipalityId,
  mockPersonNumber,
  mockPersonNumberHyphenated,
} from './helpers/mock-data';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/services/api.service', () => ({
  default: class {
    get = get;
    post = vi.fn();
    put = vi.fn();
    patch = vi.fn();
    delete = vi.fn();
  },
}));

const request = { user: { partyId: mockCitizenPartyId, personNumber: mockPersonNumber } } as unknown as RequestWithUser;

const citizen = {
  personId: mockCitizenPartyId,
  givenname: mockFirstName,
  lastname: mockLastName,
  addresses: [{ address: 'Storgatan 1', postalCode: '85230', city: 'Sundsvall', co: null, country: 'SE' }],
};

describe('GET /citizen/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('looks the citizen up by the party id from the session', async () => {
    get.mockResolvedValue({ data: citizen });

    await new CitizenController().getMe(request);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toMatchObject({
      url: expect.stringMatching(new RegExp(`/${mockMunicipalityId}/${mockCitizenPartyId}$`)) as string,
    });
  });

  it('maps the citizen to a stakeholder keyed on the session party id', async () => {
    get.mockResolvedValue({ data: { ...citizen, personId: 'ignored' } });

    await expect(new CitizenController().getMe(request)).resolves.toEqual({
      externalId: mockCitizenPartyId,
      firstName: mockFirstName,
      lastName: mockLastName,
      personNumber: mockPersonNumberHyphenated,
      address: 'Storgatan 1',
      zipCode: '85230',
      city: 'Sundsvall',
      careOf: undefined,
      country: 'SE',
    });
  });

  it('returns the citizen without an address rather than failing', async () => {
    get.mockResolvedValue({ data: { ...citizen, addresses: [] } });

    await expect(new CitizenController().getMe(request)).resolves.toMatchObject({
      externalId: mockCitizenPartyId,
      firstName: mockFirstName,
      address: undefined,
      city: undefined,
    });
  });

  it('fails on an empty Citizen response instead of returning null', async () => {
    get.mockResolvedValue({ data: undefined });

    await expect(new CitizenController().getMe(request)).rejects.toMatchObject({ status: 502 });
  });
});
