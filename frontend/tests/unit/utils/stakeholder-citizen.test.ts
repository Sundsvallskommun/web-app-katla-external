import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { hasCitizen, isCitizen, withCitizenAsContact, withoutCitizenContact } from '@utils/stakeholder';
import { describe, expect, it } from 'vitest';

const SELF: StakeholderDTO = { externalId: 'f1e2d3c4-0000-4000-8000-000000000009', firstName: 'Anna' };
const SELF_AS_CONTACT: StakeholderDTO = { ...SELF, role: 'CONTACT', externalIdType: 'PRIVATE' };
const OWNER: StakeholderDTO = { externalId: 'f1e2d3c4-0000-4000-8000-000000000001', role: 'PRIMARY' };
const MANUAL: StakeholderDTO = { externalId: '', firstName: 'Bo', role: 'CONTACT' };

describe('the citizen among the stakeholders', () => {
  it('never mistakes a manually added person for the citizen', () => {
    expect(isCitizen(MANUAL, { ...SELF, externalId: '' })).toBe(false);
    expect(isCitizen(SELF_AS_CONTACT, undefined)).toBe(false);
  });

  it('counts the citizen as present as owner or as contact, not in other roles', () => {
    expect(hasCitizen([OWNER, SELF_AS_CONTACT], SELF)).toBe(true);
    expect(hasCitizen([{ ...SELF, role: 'PRIMARY' }], SELF)).toBe(true);
    expect(hasCitizen([OWNER, { ...SELF, role: 'SUBSTITUTEASSIGNMENT' }], SELF)).toBe(false);
    expect(hasCitizen(undefined, SELF)).toBe(false);
  });

  it('adds the citizen as contact once and leaves the list alone afterwards', () => {
    const added = withCitizenAsContact([OWNER], SELF);
    expect(added).toEqual([OWNER, SELF_AS_CONTACT]);
    expect(withCitizenAsContact(added, SELF)).toBe(added);
    expect(withCitizenAsContact([{ ...SELF, role: 'PRIMARY' }], SELF)).toHaveLength(1);
  });

  it('drops only the citizen contact entry', () => {
    expect(withoutCitizenContact([OWNER, SELF_AS_CONTACT, MANUAL], SELF)).toEqual([OWNER, MANUAL]);
  });
});
