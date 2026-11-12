import SchemaForm from '@components/json/schema/schema-form.component';
import { schemaSectionsOf } from '@components/json/utils/schema-sections';
import { schemaNamesForErrand } from '@components/json/utils/schema-utils';
import { validateStep } from '@components/wizard/wizard-step-validator';
import {
  fallbackStep,
  getActiveWizardSteps,
  sectionStepId,
  type SectionWizardStep,
} from '@components/wizard/wizard-steps';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const t = ((key: string) => key) as unknown as TFunction;
// Names the field, so a test can tell which question was reported.
const tForms = ((key: string, options?: { fieldTitle?: string }) =>
  options?.fieldTitle ? `${key}: ${options.fieldTitle}` : key) as unknown as TFunction;
const context = { t, tForms, locale: 'sv', namespace: 'AOT' };

const yesNo = (title: string): RJSFSchema => ({
  type: 'string',
  title,
  oneOf: [
    { const: 'YES', title: 'Ja' },
    { const: 'NO', title: 'Nej' },
  ],
});

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    isAuthorizedSignatory: yesNo('Är du firmatecknare?'),
    servesFood: yesNo('Serveras mat?'),
    seating: { type: 'string', title: 'Sittplatser' },
  },
  required: ['isAuthorizedSignatory', 'servesFood'],
  'x-stops': [{ when: { properties: { servesFood: { const: 'NO' } }, required: ['servesFood'] }, text: 'Mat krävs' }],
};

const uiSchema: UiSchema<Record<string, unknown>> = {
  'ui:sections': [
    { id: 'foretag', title: 'Företag och fakturering', fields: ['isAuthorizedSignatory'] },
    { id: 'ansokan', title: 'Stadigvarande serveringstillstånd', fields: ['servesFood'] },
  ],
  isAuthorizedSignatory: { 'ui:widget': 'RadiobuttonWidget' },
  servesFood: { 'ui:widget': 'RadiobuttonWidget' },
};

const LABELS: ErrandFormDTO['labels'] = [
  { id: 'alkohol', classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { id: 'servering', classification: 'TYPE', resourceName: 'SERVING_PERMIT_APPLICATION' },
  { id: 'stadigvarande', classification: 'SUBTYPE', resourceName: 'PERMANENT_SERVING' },
];
const [SCHEMA_NAME = ''] = schemaNamesForErrand(LABELS, 'AOT');
const [COMPANY, APPLICATION] = schemaSectionsOf(SCHEMA_NAME, schema, uiSchema);

const sectionStep = (section: typeof COMPANY): SectionWizardStep => ({
  kind: 'section',
  id: sectionStepId(section),
  section,
});

const withAnswers = (answers: Record<string, unknown> | undefined): ErrandFormDTO => ({
  labels: LABELS,
  errandFormData:
    answers ? [{ schemaName: SCHEMA_NAME, schemaId: 'sections-schema:1', data: JSON.stringify(answers) }] : [],
});

describe('form sections as wizard steps', () => {
  it('replaces Ärendeuppgifter with one step per section, in order', () => {
    const ids = getActiveWizardSteps(true, [COMPANY, APPLICATION]).map((step) => step.id);

    expect(ids).toEqual([
      'about',
      'owner',
      'other-parties',
      sectionStepId(COMPANY),
      sectionStepId(APPLICATION),
      'attachments',
      'summary',
    ]);
  });

  it('keeps Ärendeuppgifter as one step for a form without sections', () => {
    expect(getActiveWizardSteps(true, []).map((step) => step.id)).toContain('details');
  });

  it('puts a field left outside every section in the last one, so it stays reachable', () => {
    expect(APPLICATION.fields).toEqual(['servesFood', 'seating']);
  });

  it('sends a remembered section step that no longer exists to the start of the form', () => {
    const steps = getActiveWizardSteps(true, []);

    expect(fallbackStep(steps, sectionStepId(COMPANY)).id).toBe('details');
    expect(fallbackStep(steps, 'other-parties').id).toBe('about');
  });
});

describe('validating a section step', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ schema, uiSchema, schemaId: 'sections-schema:1' }), { status: 200 })
        )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the unanswered question of an untouched form', async () => {
    const errors = await validateStep(sectionStep(COMPANY), withAnswers(undefined), context);

    expect(errors).toEqual(['form_field_error: Är du firmatecknare?']);
  });

  it('ignores questions of the sections still to come', async () => {
    const errors = await validateStep(sectionStep(COMPANY), withAnswers({ isAuthorizedSignatory: 'YES' }), context);

    expect(errors).toEqual([]);
  });

  it('holds back only the section whose answer rules the application out', async () => {
    const answers = { isAuthorizedSignatory: 'YES', servesFood: 'NO' };

    await expect(validateStep(sectionStep(COMPANY), withAnswers(answers), context)).resolves.toEqual([]);
    await expect(validateStep(sectionStep(APPLICATION), withAnswers(answers), context)).resolves.toEqual(['Mat krävs']);
  });
});

describe('rendering a section step', () => {
  function SectionForm({ fields }: { fields: readonly string[] }) {
    const methods = useForm();
    return (
      <FormProvider {...methods}>
        <SchemaForm schemaId="sections-render:1" schema={schema} uiSchema={uiSchema} hideSubmitButton fields={fields} />
      </FormProvider>
    );
  }

  it('shows only the section’s questions, without the accordion its heading replaces', () => {
    render(<SectionForm fields={APPLICATION.fields} />);

    expect(screen.getByRole('group', { name: /Serveras mat/ })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /Sittplatser/ })).toBeVisible();
    expect(screen.queryByRole('group', { name: /firmatecknare/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Stadigvarande serveringstillstånd')).not.toBeInTheDocument();
  });
});
