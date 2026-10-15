// Serveringsställe has no field of its own upstream: it rides in the stakeholder's parameters,
// so the mapping is the only thing keeping it attached to the errand owner.

import { describe, expect, it } from 'vitest';

import { Stakeholder } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { StakeholderDTO } from '@/responses/supportmanagement.response';
import { mapStakeholderDTOToStakeholder, mapStakeholderToStakeholderDTO } from '@/utils/stakeholder-mapping';

const owner = (overrides: Partial<StakeholderDTO> = {}): StakeholderDTO => ({
  role: 'PRIMARY',
  externalId: '11111111-2222-4333-8444-555555555555',
  externalIdType: 'COMPANY',
  organizationName: 'Selånger Padelcenter AB',
  ...overrides,
});

describe('stakeholder serveringsstalle mapping', () => {
  it('sends the serving location as a parameter value', () => {
    const mapped = mapStakeholderDTOToStakeholder(owner({ serveringsstalle: 'Selånger Padelcenter' }));

    expect(mapped.parameters).toContainEqual({ key: 'serveringsstalle', values: ['Selånger Padelcenter'] });
  });

  it('reads the serving location back off the parameters', () => {
    const upstream: Stakeholder = {
      role: 'PRIMARY',
      organizationName: 'Selånger Padelcenter AB',
      parameters: [{ key: 'serveringsstalle', values: ['Selånger Padelcenter'] }],
    };

    expect(mapStakeholderToStakeholderDTO(upstream).serveringsstalle).toBe('Selånger Padelcenter');
  });

  it('survives a round trip', () => {
    // owner() builds a fresh object per call, which mapStakeholderDTOToStakeholder needs: it
    // deletes personNumber from what it is handed.
    const details = { serveringsstalle: 'Kustbryggan', emails: ['a@b.se'], phoneNumbers: ['+46701234567'] };

    const returned = mapStakeholderToStakeholderDTO(mapStakeholderDTOToStakeholder(owner(details)));

    expect(returned.serveringsstalle).toBe('Kustbryggan');
    expect(returned.emails).toEqual(['a@b.se']);
    expect(returned.phoneNumbers).toEqual(['+46701234567']);
  });

  // An empty parameter would read as "the citizen entered nothing", which is not the same as
  // never having been asked.
  it('omits the parameter entirely when no serving location was given', () => {
    const mapped = mapStakeholderDTOToStakeholder(owner());

    expect(mapped.parameters?.some(parameter => parameter.key === 'serveringsstalle')).toBe(false);
    expect(mapStakeholderToStakeholderDTO({ role: 'PRIMARY' }).serveringsstalle).toBeUndefined();
  });

  it('reads the organisation number back off the parameters', () => {
    const upstream: Stakeholder = {
      role: 'PRIMARY',
      parameters: [{ key: 'organizationNumber', displayName: 'Organisationsnummer', values: ['111111-2222'] }],
    };

    expect(mapStakeholderToStakeholderDTO(upstream).organizationNumber).toBe('111111-2222');
  });

  it('drops a client-sent organisation number', () => {
    const mapped = mapStakeholderDTOToStakeholder(owner({ organizationNumber: '111111-2222' }));

    expect(mapped).not.toHaveProperty('organizationNumber');
    expect(mapped.parameters).toEqual([]);
  });
});
