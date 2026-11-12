import { schemaNamesForErrand } from '@components/json/utils/schema-utils';
import { validateStep } from '@components/wizard/wizard-step-validator';
import { ALL_WIZARD_STEPS } from '@components/wizard/wizard-steps';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadFormSchemaMock, validateErrandFormDataMock } = vi.hoisted(() => ({
  loadFormSchemaMock: vi.fn(),
  validateErrandFormDataMock: vi.fn(),
}));

vi.mock('@components/json/utils/schema-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@components/json/utils/schema-utils')>()),
  loadFormSchema: loadFormSchemaMock,
  validateErrandFormData: validateErrandFormDataMock,
}));

const t = ((key: string) => key) as unknown as TFunction;
const tForms = ((key: string) => `forms:${key}`) as unknown as TFunction;
const context = { t, tForms, locale: 'sv', namespace: 'AOT' };
const detailsStep = ALL_WIZARD_STEPS.find((step) => step.id === 'details');
if (!detailsStep) throw new Error('The wizard has no details step');

const LABELS: ErrandFormDTO['labels'] = [
  { id: 'alkohol', classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { id: 'servering', classification: 'TYPE', resourceName: 'SERVING_PERMIT_APPLICATION' },
  { id: 'stadigvarande', classification: 'SUBTYPE', resourceName: 'PERMANENT_SERVING' },
];

beforeEach(() => {
  validateErrandFormDataMock.mockReset().mockResolvedValue([]);
  loadFormSchemaMock.mockReset().mockResolvedValue({ schema: { type: 'object' } });
});

describe('wizard details step', () => {
  // Without the schema names the check filters every entry away and passes an empty form.
  it('requires the forms of the ärendetyp, in the forms language', async () => {
    const [schemaName] = schemaNamesForErrand(LABELS, 'AOT');

    await validateStep(detailsStep, { labels: LABELS }, context);

    expect(validateErrandFormDataMock).toHaveBeenCalledWith([], tForms, 'sv', [schemaName]);
  });

  it('reports what the form check reports', async () => {
    validateErrandFormDataMock.mockResolvedValue(['forms:form_error']);

    await expect(validateStep(detailsStep, { labels: LABELS }, context)).resolves.toEqual(['forms:form_error']);
  });

  it('holds a valid form back while one of its answers rules the application out', async () => {
    const [schemaName = ''] = schemaNamesForErrand(LABELS, 'AOT');
    loadFormSchemaMock.mockResolvedValue({
      schema: {
        type: 'object',
        'x-stops': [
          { when: { properties: { serverasMat: { const: 'NEJ' } }, required: ['serverasMat'] }, text: 'Stopp' },
        ],
      },
    });
    const errandFormData = [{ schemaName, schemaId: 'schema-v1', data: JSON.stringify({ serverasMat: 'NEJ' }) }];

    await expect(validateStep(detailsStep, { labels: LABELS, errandFormData }, context)).resolves.toEqual(['Stopp']);
  });
});
