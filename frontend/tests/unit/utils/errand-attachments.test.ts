import { loadFormSchema, SchemaNotFoundError } from '@components/json/utils/schema-utils';
import { ErrandFormDTO } from '@interfaces/errand-form';
import type { RJSFSchema } from '@rjsf/utils';
import {
  answersOfErrand,
  attachmentTypesOfSchema,
  missingRequiredAttachments,
  requiredAttachmentTypes,
  validateErrandAttachments,
} from '@utils/errand-attachments';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@components/json/utils/schema-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@components/json/utils/schema-utils')>()),
  loadFormSchema: vi.fn(),
}));

const loadFormSchemaMock = vi.mocked(loadFormSchema);

// Echoes the key back, so an assertion names the message the citizen is shown.
const t = ((key: string) => key) as unknown as TFunction;

const labels = [
  { classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { classification: 'TYPE', resourceName: 'SERVING_PERMIT_APPLICATION' },
];
const schemaName = 'aot_alcohol_serving_permit_application';

/**
 * Shaped like a published schema's own declaration, covering all three condition forms the
 * schemas use: const, enum and array-contains.
 */
const schema = {
  type: 'object',
  properties: {},
  'x-attachments': [
    {
      key: 'POWER_OF_ATTORNEY',
      label: 'Fullmakt',
      requiredWhen: { properties: { arDuFirmatecknare: { const: 'NEJ' } }, required: ['arDuFirmatecknare'] },
    },
    {
      key: 'TAX_AGENCY_EXTRACT',
      label: 'Registerutdrag från Skatteverket',
      description: 'Hämtas på verksamt.se.',
      requiredWhen: {
        properties: { foretagsform: { enum: ['AKTIEBOLAG', 'HANDELSBOLAG'] } },
        required: ['foretagsform'],
      },
    },
    {
      key: 'BANK_STATEMENT',
      label: 'Kontoutdrag för egna medel',
      requiredWhen: {
        properties: { finansiering: { contains: { const: 'EGNA_MEDEL' } } },
        required: ['finansiering'],
      },
    },
    { key: 'FLOOR_PLAN', label: 'Planritning' },
  ],
} as unknown as RJSFSchema;

const types = attachmentTypesOfSchema(schema);
const keysOf = (list: { key: string }[]) => list.map((type) => type.key);

const errand = (answers: Record<string, unknown>, attachments?: ErrandFormDTO['attachments']): ErrandFormDTO => ({
  errandFormData: [{ schemaName: 'aot_tasting', schemaId: 'id', data: JSON.stringify(answers) }],
  attachments,
});

describe('errand attachments', () => {
  it('reads the bilagor the schema declares', () => {
    expect(keysOf(types)).toEqual(['POWER_OF_ATTORNEY', 'TAX_AGENCY_EXTRACT', 'BANK_STATEMENT', 'FLOOR_PLAN']);
  });

  it('has no bilagor for a schema that declares none', () => {
    expect(attachmentTypesOfSchema({ type: 'object' })).toEqual([]);
    expect(attachmentTypesOfSchema(null)).toEqual([]);
  });

  // The schema is maintained in another system and reaches the citizen with no build step, so a
  // malformed entry must not take the whole Bilagor section down with it.
  it('skips a declared entry that is missing a key or label', () => {
    const partial = { 'x-attachments': [{ key: 'utanEtikett' }, { label: 'Utan nyckel' }, 'nonsense'] };

    expect(attachmentTypesOfSchema(partial as unknown as RJSFSchema)).toEqual([]);
  });

  it('requires nothing while the questions that decide it are unanswered', () => {
    expect(requiredAttachmentTypes(types, {})).toEqual([]);
  });

  it('always requires a bilaga with an empty requiredWhen', () => {
    const always = attachmentTypesOfSchema({
      'x-attachments': [{ key: 'BUDGET', label: 'Budget', requiredWhen: {} }],
    });

    expect(keysOf(requiredAttachmentTypes(always, {}))).toEqual(['BUDGET']);
    expect(keysOf(requiredAttachmentTypes(always, { arDuFirmatecknare: 'JA' }))).toEqual(['BUDGET']);
  });

  it('requires the fullmakt only when the applicant is not a firmatecknare', () => {
    expect(keysOf(requiredAttachmentTypes(types, { arDuFirmatecknare: 'JA' }))).not.toContain('POWER_OF_ATTORNEY');
    expect(keysOf(requiredAttachmentTypes(types, { arDuFirmatecknare: 'NEJ' }))).toContain('POWER_OF_ATTORNEY');
  });

  it('reads an enum membership condition', () => {
    expect(keysOf(requiredAttachmentTypes(types, { foretagsform: 'AKTIEBOLAG' }))).toEqual(['TAX_AGENCY_EXTRACT']);
    expect(requiredAttachmentTypes(types, { foretagsform: 'ENSKILD_FIRMA' })).toEqual([]);
  });

  it('reads an array-contains condition', () => {
    expect(keysOf(requiredAttachmentTypes(types, { finansiering: ['BANKLAN', 'EGNA_MEDEL'] }))).toEqual([
      'BANK_STATEMENT',
    ]);
    expect(requiredAttachmentTypes(types, { finansiering: ['BANKLAN'] })).toEqual([]);
  });

  it('counts a required bilaga as delivered once a file carries its category', () => {
    const answers = { arDuFirmatecknare: 'NEJ' };
    expect(keysOf(missingRequiredAttachments(types, answers, undefined))).toEqual(['POWER_OF_ATTORNEY']);
    expect(
      missingRequiredAttachments(types, answers, [{ category: 'POWER_OF_ATTORNEY', fileName: 'fullmakt.pdf' }])
    ).toEqual([]);
  });

  it('accepts several files of the same category', () => {
    expect(
      missingRequiredAttachments(types, { arDuFirmatecknare: 'NEJ' }, [
        { category: 'POWER_OF_ATTORNEY', fileName: 'fullmakt-1.pdf' },
        { category: 'POWER_OF_ATTORNEY', fileName: 'fullmakt-2.pdf' },
      ])
    ).toEqual([]);
  });

  it('a file of another category does not satisfy the requirement', () => {
    const missing = missingRequiredAttachments(types, { arDuFirmatecknare: 'NEJ' }, [
      { category: 'FLOOR_PLAN', fileName: 'ritning.pdf' },
    ]);

    expect(keysOf(missing)).toEqual(['POWER_OF_ATTORNEY']);
  });

  describe('validating before registration', () => {
    beforeEach(() => {
      loadFormSchemaMock.mockReset();
    });

    it('blocks registration while a required bilaga is missing', async () => {
      loadFormSchemaMock.mockResolvedValue({ schema, schemaId: 'id' });

      const values: ErrandFormDTO = {
        labels,
        errandFormData: [{ schemaName, schemaId: 'id', data: '{"arDuFirmatecknare":"NEJ"}' }],
      };

      expect(await validateErrandAttachments(values, t, 'sv', 'aot')).toEqual(['validation:attachments.required']);
    });

    it('names every missing bilaga when several are required', async () => {
      loadFormSchemaMock.mockResolvedValue({ schema, schemaId: 'id' });
      const spyT = vi.fn((key: string) => key) as unknown as TFunction;

      const values: ErrandFormDTO = {
        labels,
        errandFormData: [
          { schemaName, schemaId: 'id', data: '{"arDuFirmatecknare":"NEJ","foretagsform":"AKTIEBOLAG"}' },
        ],
      };

      expect(await validateErrandAttachments(values, spyT, 'sv', 'aot')).toEqual([
        'validation:attachments.required_several',
      ]);
      expect(spyT).toHaveBeenCalledWith('validation:attachments.required_several', {
        labels: '"Fullmakt", "Registerutdrag från Skatteverket"',
      });
    });

    it('lets an errand type without a schema through', async () => {
      loadFormSchemaMock.mockRejectedValue(new SchemaNotFoundError(schemaName));

      expect(await validateErrandAttachments({ labels }, t, 'sv', 'aot')).toEqual([]);
    });

    it('reports a failed schema load instead of throwing', async () => {
      loadFormSchemaMock.mockRejectedValue(new Error('500'));

      expect(await validateErrandAttachments({ labels }, t, 'sv', 'aot')).toEqual([
        'validation:attachments.check_failed',
      ]);
    });
  });

  it('reads the answers of the errand type being filled in', () => {
    expect(answersOfErrand(errand({ foretagsform: 'AKTIEBOLAG' }), 'aot_tasting')).toEqual({
      foretagsform: 'AKTIEBOLAG',
    });
    expect(answersOfErrand(errand({ foretagsform: 'AKTIEBOLAG' }), 'aot_farm_sales')).toEqual({});
  });
});
