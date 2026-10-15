import { loadFormSchema, SchemaNotFoundError } from '@components/json/utils/schema-utils';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import type { RJSFSchema } from '@rjsf/utils';
import { activeStops, stopAnchor, stopsOfSchema, validateErrandStops } from '@utils/schema-stops';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@components/json/utils/schema-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@components/json/utils/schema-utils')>()),
  loadFormSchema: vi.fn(),
}));

const loadFormSchemaMock = vi.mocked(loadFormSchema);

const t = ((key: string) => key) as unknown as TFunction;

const labels = [
  { classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { classification: 'TYPE', resourceName: 'FOLKOL_SALES_NOTIFICATION' },
];
const schemaName = 'aot_alcohol_folkol_sales_notification';

const bothNo = {
  when: {
    properties: { saljerLivsmedel: { const: 'NEJ' }, tillverkarFolkol: { const: 'NEJ' } },
    required: ['saljerLivsmedel', 'tillverkarFolkol'],
  },
  text: 'Du kan inte anmäla försäljning av folköl.',
};

const schema = {
  type: 'object',
  properties: {},
  'x-stops': [bothNo],
} as unknown as RJSFSchema;

const errand = (answers: Record<string, unknown>): ErrandFormDTO => ({
  labels,
  errandFormData: [{ schemaName, schemaId: 'id', data: JSON.stringify(answers) }],
});

describe('schema stops', () => {
  it('reads the stops the schema declares', () => {
    expect(stopsOfSchema(schema)).toEqual([bothNo]);
    expect(stopsOfSchema({ type: 'object' })).toEqual([]);
    expect(stopsOfSchema(null)).toEqual([]);
  });

  // Without when.required the condition holds before anything is answered.
  it('skips an entry without text or without a required answer', () => {
    const malformed = {
      'x-stops': [{ when: bothNo.when }, { when: { properties: bothNo.when.properties }, text: 'Stopp' }, 'nonsense'],
    };

    expect(stopsOfSchema(malformed as unknown as RJSFSchema)).toEqual([]);
  });

  it('holds only once every answer it names is given', () => {
    const stops = stopsOfSchema(schema);

    expect(activeStops(stops, {})).toEqual([]);
    expect(activeStops(stops, { saljerLivsmedel: 'NEJ' })).toEqual([]);
    expect(activeStops(stops, { saljerLivsmedel: 'NEJ', tillverkarFolkol: 'JA' })).toEqual([]);
    expect(activeStops(stops, { saljerLivsmedel: 'NEJ', tillverkarFolkol: 'NEJ' })).toEqual([bothNo]);
  });

  it('is shown under the last answer it names', () => {
    expect(stopAnchor(bothNo)).toBe('tillverkarFolkol');
  });

  describe('validating before registration', () => {
    beforeEach(() => {
      loadFormSchemaMock.mockReset();
    });

    it('blocks registration with the stop text', async () => {
      loadFormSchemaMock.mockResolvedValue({ schema, schemaId: 'id' });

      expect(
        await validateErrandStops(errand({ saljerLivsmedel: 'NEJ', tillverkarFolkol: 'NEJ' }), t, 'sv', 'aot')
      ).toEqual([bothNo.text]);
      expect(
        await validateErrandStops(errand({ saljerLivsmedel: 'JA', tillverkarFolkol: 'NEJ' }), t, 'sv', 'aot')
      ).toEqual([]);
    });

    it('lets an errand type without a schema through', async () => {
      loadFormSchemaMock.mockRejectedValue(new SchemaNotFoundError(schemaName));

      expect(await validateErrandStops({ labels }, t, 'sv', 'aot')).toEqual([]);
    });

    it('reports a failed schema load instead of throwing', async () => {
      loadFormSchemaMock.mockRejectedValue(new Error('500'));

      expect(await validateErrandStops({ labels }, t, 'sv', 'aot')).toEqual(['validation:stops.check_failed']);
    });
  });
});
