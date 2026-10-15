import { validateStep } from '@components/wizard/wizard-step-validator';
import { ALL_WIZARD_STEPS } from '@components/wizard/wizard-steps';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

const t = ((key: string) => key) as unknown as TFunction;
const context = { t, tForms: t, locale: 'sv', namespace: 'AOT' };
const ownerStep = ALL_WIZARD_STEPS.find((step) => step.id === 'owner');
if (!ownerStep) throw new Error('The wizard has no owner step');

const formValues = (stakeholders?: ErrandFormDTO['stakeholders']): ErrandFormDTO => ({ stakeholders });

describe('wizard owner step', () => {
  it('marks the step incomplete while no owner has been chosen', async () => {
    await expect(validateStep(ownerStep, formValues(), context)).resolves.toEqual(['validation:owner.required']);
  });

  it('does not accept a contact as the owner', async () => {
    const contact = [{ role: 'CONTACT', firstName: 'Anna', lastName: 'Andersson' }];

    await expect(validateStep(ownerStep, formValues(contact), context)).resolves.toEqual(['validation:owner.required']);
  });

  it('accepts the step once an organization is the primary stakeholder', async () => {
    const owner = [{ role: 'PRIMARY', externalId: 'f1e2d3c4-0000-4000-8000-000000000001' }];

    await expect(validateStep(ownerStep, formValues(owner), context)).resolves.toEqual([]);
  });

  it('accepts the step once the citizen themself is the primary stakeholder', async () => {
    const owner = [{ role: 'PRIMARY', externalIdType: 'PRIVATE', externalId: 'f1e2d3c4-0000-4000-8000-000000000009' }];

    await expect(validateStep(ownerStep, formValues(owner), context)).resolves.toEqual([]);
  });
});
