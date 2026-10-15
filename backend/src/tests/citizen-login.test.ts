// Login is for citizens, not employees: no group claim is read and no role or permission is set.
// The identity is the citizen identifier from the profile, exchanged for a party id via Citizen.

import { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadRepresentingOrganizations } from '@/auth/login-session';
import { citizenVerify } from '@/auth/verify.citizen';
import { HttpException } from '@/exceptions/HttpException';
import { Profile } from '@/interfaces/profile.interface';
import { User } from '@/interfaces/users.interface';

import {
  mockCitizenPartyId,
  mockFirstName,
  mockFutureDatePersonNumber,
  mockLastName,
  mockOrganizationName,
  mockOrganizationNumber,
  mockOrganizationPartyId,
  mockPersonNumber,
  mockPersonNumberShort,
  mockServiceKey,
} from './helpers/mock-data';

const { getCitizenPartyId, getMyOrganizations } = vi.hoisted(() => ({
  getCitizenPartyId: vi.fn<() => Promise<string>>(),
  getMyOrganizations: vi.fn<() => Promise<Record<string, unknown[]>>>(),
}));

vi.mock('@/services/citizen.service', () => ({ getCitizenPartyId }));
vi.mock('@/services/legal-entity.service', () => ({ getMyOrganizations }));

const citizenProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({
    firstname: mockFirstName,
    Surname: mockLastName,
    citizenIdentifier: mockPersonNumber,
    ...overrides,
  }) as Profile;

/** Collects what the strategy reported, the way passport would. */
const verify = async (profile: Profile | null) => {
  const done = vi.fn<(error: unknown, user?: unknown, info?: unknown) => void>();

  await citizenVerify(profile, done);

  const call = done.mock.calls[0];
  if (!call) throw new Error('Expected the verification to report a result');
  const [error, user, info] = call;

  return { error, user: user as User | undefined, info: info as { name?: string } | undefined };
};

describe('citizen SAML verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCitizenPartyId.mockResolvedValue(mockCitizenPartyId);
  });

  it('keys the user on the party id Citizen returns for the citizen identifier', async () => {
    const { error, user } = await verify(citizenProfile());

    expect(error).toBeNull();
    expect(getCitizenPartyId).toHaveBeenCalledWith(mockPersonNumber, expect.anything());
    expect(user).toMatchObject({
      partyId: mockCitizenPartyId,
      personNumber: mockPersonNumber,
      name: `${mockFirstName} ${mockLastName}`,
      firstName: mockFirstName,
      lastName: mockLastName,
    });
  });

  // Citizens are not employees, so nothing here may hand out a role or a permission.
  it('sets no groups, role or permissions', async () => {
    const { user } = await verify(citizenProfile());

    expect(user).not.toHaveProperty('groups');
    expect(user).not.toHaveProperty('role');
    expect(user).not.toHaveProperty('permissions');
  });

  it('normalizes a ten-digit citizen identifier before the Citizen lookup', async () => {
    await verify(citizenProfile({ citizenIdentifier: mockPersonNumberShort }));

    expect(getCitizenPartyId).toHaveBeenCalledWith(mockPersonNumber, expect.anything());
  });

  it('refuses a citizen identifier that is not a person number', async () => {
    const { user, info } = await verify(citizenProfile({ citizenIdentifier: mockFutureDatePersonNumber }));

    expect(user).toBeUndefined();
    expect(info?.name).toBe('SAML_INVALID_CITIZEN_IDENTIFIER');
    expect(getCitizenPartyId).not.toHaveBeenCalled();
  });

  it('tells a profile without a citizen identifier apart from one missing its name attributes', async () => {
    const { user, info } = await verify(citizenProfile({ citizenIdentifier: undefined }));

    expect(user).toBeUndefined();
    expect(info?.name).toBe('SAML_MISSING_CITIZEN_IDENTIFIER');
    expect(getCitizenPartyId).not.toHaveBeenCalled();
  });

  it('refuses a profile missing its name attributes', async () => {
    const { user, info } = await verify(citizenProfile({ Surname: undefined }));

    expect(user).toBeUndefined();
    expect(info?.name).toBe('SAML_MISSING_ATTRIBUTES');
    expect(getCitizenPartyId).not.toHaveBeenCalled();
  });

  it('refuses a missing profile', async () => {
    const { error } = await verify(null);

    expect(error).toMatchObject({ name: 'SAML_MISSING_PROFILE' });
  });

  it('reports a citizen Citizen does not know rather than logging them in', async () => {
    getCitizenPartyId.mockRejectedValue(new HttpException(404, 'Not found'));

    const { user, info } = await verify(citizenProfile());

    expect(user).toBeUndefined();
    expect(info?.name).toBe('SAML_CITIZEN_FAILED');
  });

  it('does not log a citizen in when the Citizen exchange fails', async () => {
    getCitizenPartyId.mockRejectedValue(new HttpException(500, 'Upstream down'));

    const { error, user } = await verify(citizenProfile());

    expect(user).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
  });
});

describe('organizations resolved at login', () => {
  const mockOrganization = {
    partyId: mockOrganizationPartyId,
    organizationNumber: mockOrganizationNumber,
    organizationName: mockOrganizationName,
    isAuthorizedSignatory: true,
  };

  const sessionSave = vi.fn((callback: (err?: Error) => void) => {
    callback();
  });

  const loggedInRequest = () =>
    ({
      user: {
        partyId: mockCitizenPartyId,
        personNumber: mockPersonNumber,
        name: `${mockFirstName} ${mockLastName}`,
        firstName: mockFirstName,
        lastName: mockLastName,
      },
      session: { save: sessionSave },
    }) as unknown as Request;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('puts the citizen organizations in the session', async () => {
    getMyOrganizations.mockResolvedValue({ [mockServiceKey]: [mockOrganization] });
    const req = loggedInRequest();

    await loadRepresentingOrganizations(req);

    expect(getMyOrganizations).toHaveBeenCalledWith(mockPersonNumber, mockCitizenPartyId, expect.anything());
    expect(req.session.representingBusinessChoices).toEqual({ [mockServiceKey]: [mockOrganization] });
  });

  it('persists the session so the scope survives the redirect', async () => {
    getMyOrganizations.mockResolvedValue({ [mockServiceKey]: [mockOrganization] });
    const req = loggedInRequest();

    await loadRepresentingOrganizations(req);

    expect(sessionSave).toHaveBeenCalled();
  });

  // No organizations means the errand endpoints answer 403, which is the intended failure.
  it('leaves the session unscoped rather than failing the login when the lookup fails', async () => {
    getMyOrganizations.mockRejectedValue(new Error('LegalEntity down'));
    const req = loggedInRequest();

    await expect(loadRepresentingOrganizations(req)).resolves.toBeUndefined();

    expect(req.session.representingBusinessChoices).toBeUndefined();
  });
});
