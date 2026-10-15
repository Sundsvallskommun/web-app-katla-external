import { schemaNamesForErrand } from '@components/json/utils/schema-utils';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import { validateErrandForSave } from '@utils/errand-preconditions';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateErrandAttachmentsMock, validateErrandFormDataMock, validateErrandStopsMock } = vi.hoisted(() => ({
  validateErrandAttachmentsMock: vi.fn(),
  validateErrandFormDataMock: vi.fn(),
  validateErrandStopsMock: vi.fn(),
}));

// What makes a form or its bilagor valid is covered where those rules live; here only the order
// and the scope of the calls matter.
vi.mock('@components/json/utils/schema-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@components/json/utils/schema-utils')>()),
  validateErrandFormData: validateErrandFormDataMock,
}));

vi.mock('@utils/errand-attachments', () => ({
  validateErrandAttachments: validateErrandAttachmentsMock,
}));

vi.mock('@utils/schema-stops', () => ({
  validateErrandStops: validateErrandStopsMock,
}));

const t = ((key: string) => key) as unknown as TFunction;
const tForms = ((key: string) => `forms:${key}`) as unknown as TFunction;
const context = { t, tForms, locale: 'sv', namespace: 'AOT' };

const OWNER: ErrandFormDTO['stakeholders'] = [{ role: 'PRIMARY', externalId: 'f1e2d3c4-0000-4000-8000-000000000001' }];

const LABELS: ErrandFormDTO['labels'] = [
  { id: 'alkohol', classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { id: 'servering', classification: 'TYPE', resourceName: 'SERVING_PERMIT_APPLICATION' },
  { id: 'stadigvarande', classification: 'SUBTYPE', resourceName: 'PERMANENT_SERVING' },
];

const [SCHEMA_NAME] = schemaNamesForErrand(LABELS, 'AOT');
const OTHER_SCHEMA_NAME = 'aot_tobacco_sales_permit_application';

const errand = (overrides: Partial<ErrandFormDTO> = {}): ErrandFormDTO => ({
  labels: LABELS,
  stakeholders: OWNER,
  ...overrides,
});

beforeEach(() => {
  validateErrandAttachmentsMock.mockReset().mockResolvedValue([]);
  validateErrandFormDataMock.mockReset().mockResolvedValue([]);
  validateErrandStopsMock.mockReset().mockResolvedValue([]);
});

describe('validateErrandForSave for a registration', () => {
  it('asks for the categorization before anything else is looked at', async () => {
    await expect(validateErrandForSave(errand({ labels: [] }), 'register', context)).resolves.toEqual([
      'validation:categorization.category_required',
    ]);
    expect(validateErrandFormDataMock).not.toHaveBeenCalled();
    expect(validateErrandAttachmentsMock).not.toHaveBeenCalled();
  });

  it('asks for the owner once categorized', async () => {
    await expect(validateErrandForSave(errand({ stakeholders: [] }), 'register', context)).resolves.toEqual([
      'validation:owner.required',
    ]);
  });

  it('requires every form of the ärendetyp, in the forms language', async () => {
    await validateErrandForSave(errand(), 'register', context);

    expect(validateErrandFormDataMock).toHaveBeenCalledWith([], tForms, 'sv', [SCHEMA_NAME]);
  });

  it('checks the bilagor last and reports the first failing rule only', async () => {
    validateErrandAttachmentsMock.mockResolvedValue(['validation:attachments.required']);

    await expect(validateErrandForSave(errand(), 'register', context)).resolves.toEqual([
      'validation:attachments.required',
    ]);
  });

  // The stop text is already shown under the answer, so the form's own errors come first.
  it('reports a stop after the form and before the bilagor', async () => {
    validateErrandStopsMock.mockResolvedValue(['Du kan inte anmäla försäljning av folköl.']);

    await expect(validateErrandForSave(errand(), 'register', context)).resolves.toEqual([
      'Du kan inte anmäla försäljning av folköl.',
    ]);
    expect(validateErrandFormDataMock).toHaveBeenCalled();
    expect(validateErrandAttachmentsMock).not.toHaveBeenCalled();
  });

  it('stops at a failing form and leaves the bilagor unchecked', async () => {
    validateErrandFormDataMock.mockResolvedValue(['forms:form_error']);

    await expect(validateErrandForSave(errand(), 'register', context)).resolves.toEqual(['forms:form_error']);
    expect(validateErrandAttachmentsMock).not.toHaveBeenCalled();
  });
});

describe('validateErrandForSave for a draft', () => {
  it('needs an owner, so the draft can be read back', async () => {
    await expect(validateErrandForSave(errand({ stakeholders: [] }), 'draft', context)).resolves.toEqual([
      'validation:owner.required',
    ]);
  });

  it('accepts an uncategorized draft and asks for no bilagor', async () => {
    await expect(validateErrandForSave(errand({ labels: [] }), 'draft', context)).resolves.toEqual([]);
    expect(validateErrandAttachmentsMock).not.toHaveBeenCalled();
  });

  it('saves a draft even while a stop holds', async () => {
    validateErrandStopsMock.mockResolvedValue(['Stopp']);

    await expect(validateErrandForSave(errand(), 'draft', context)).resolves.toEqual([]);
    expect(validateErrandStopsMock).not.toHaveBeenCalled();
  });

  it('validates only the forms that have been opened', async () => {
    const opened = { schemaName: SCHEMA_NAME, data: '{}' };
    const leftBehind = { schemaName: OTHER_SCHEMA_NAME, data: '{}' };

    await validateErrandForSave(errand({ errandFormData: [opened, leftBehind] }), 'draft', context);

    expect(validateErrandFormDataMock).toHaveBeenCalledWith([opened], tForms, 'sv', [SCHEMA_NAME]);
  });

  it('requires no form of a draft whose form has not been opened', async () => {
    await validateErrandForSave(errand(), 'draft', context);

    expect(validateErrandFormDataMock).toHaveBeenCalledWith([], tForms, 'sv', []);
  });
});
