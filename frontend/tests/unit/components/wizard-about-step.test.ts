import { validateStep } from '@components/wizard/wizard-step-validator';
import { ALL_WIZARD_STEPS } from '@components/wizard/wizard-steps';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

const t = ((key: string) => key) as unknown as TFunction;
const context = { t, tForms: t, locale: 'sv', namespace: 'AOT' };
const aboutStep = ALL_WIZARD_STEPS.find((step) => step.id === 'about');
if (!aboutStep) throw new Error('The wizard has no about step');

const formValues = (labels?: ErrandFormDTO['labels']): ErrandFormDTO => ({ labels });

describe('wizard about step', () => {
  it('asks for a category while nothing has been chosen', async () => {
    await expect(validateStep(aboutStep, formValues(), context)).resolves.toEqual([
      'validation:categorization.category_required',
    ]);
  });

  it('asks for a type once the category is chosen', async () => {
    const labels = [{ id: 'alkohol', classification: 'CATEGORY' }];

    await expect(validateStep(aboutStep, formValues(labels), context)).resolves.toEqual([
      'validation:categorization.type_required',
    ]);
  });

  it('accepts a leaf type filed without a subtype', async () => {
    const labels = [
      { id: 'alkohol', classification: 'CATEGORY' },
      { id: 'folkol', classification: 'TYPE' },
    ];

    await expect(validateStep(aboutStep, formValues(labels), context)).resolves.toEqual([]);
  });

  it('accepts the full three-level path', async () => {
    const labels = [
      { id: 'alkohol', classification: 'CATEGORY' },
      { id: 'servering', classification: 'TYPE' },
      { id: 'stadigvarande', classification: 'SUBTYPE' },
    ];

    await expect(validateStep(aboutStep, formValues(labels), context)).resolves.toEqual([]);
  });
});
