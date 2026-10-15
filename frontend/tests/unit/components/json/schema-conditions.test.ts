import {
  getConditionalFields,
  matchesSchemaCondition,
  stripHiddenFields,
  visibleFields,
} from '@components/json/utils/schema-conditions';
import type { RJSFSchema } from '@rjsf/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('matchesSchemaCondition', () => {
  it.each([
    ['const matches', { const: 'YES' }, 'YES', true],
    ['const differs', { const: 'YES' }, 'NO', false],
    ['const is strict about type', { const: 1 }, '1', false],
    ['enum contains the value', { enum: ['AB', 'HB'] }, 'HB', true],
    ['enum does not contain the value', { enum: ['AB', 'HB'] }, 'EF', false],
    ['contains finds the item', { contains: { const: 'A' } }, ['B', 'A'], true],
    ['contains misses', { contains: { const: 'A' } }, ['B'], false],
    ['contains against a non-array', { contains: { const: 'A' } }, 'A', false],
    ['not inverts', { not: { const: 'YES' } }, 'NO', true],
    ['allOf needs every part', { allOf: [{ enum: ['A', 'B'] }, { not: { const: 'B' } }] }, 'A', true],
    ['anyOf needs one part', { anyOf: [{ const: 'A' }, { const: 'B' }] }, 'B', true],
    ['oneOf needs exactly one', { oneOf: [{ const: 'A' }, { enum: ['A', 'B'] }] }, 'A', false],
    ['boolean true always matches', true, 'anything', true],
    ['boolean false never matches', false, 'anything', false],
  ])('%s', (_case, condition, value, expected) => {
    expect(matchesSchemaCondition(condition, value)).toBe(expected);
  });

  it('treats an absent key as satisfying properties, which is why rules pair it with required', () => {
    const condition = { properties: { foretagsform: { const: 'AB' } } };

    expect(matchesSchemaCondition(condition, {})).toBe(true);
    expect(matchesSchemaCondition({ ...condition, required: ['foretagsform'] }, {})).toBe(false);
  });

  it('recurses into nested properties', () => {
    const condition = { properties: { adress: { properties: { postort: { const: 'Sundsvall' } } } } };

    expect(matchesSchemaCondition(condition, { adress: { postort: 'Sundsvall' } })).toBe(true);
    expect(matchesSchemaCondition(condition, { adress: { postort: 'Timrå' } })).toBe(false);
  });
});

describe('the condition shapes the OpenE rules flatten into', () => {
  // "visa filuppladdningsfråga skatteverket": one rule, several allowed alternatives.
  const orOverAlternatives = {
    if: { properties: { foretagsform: { enum: ['AB', 'HB', 'KB'] } }, required: ['foretagsform'] },
    then: { required: ['bifogatRegisterutdrag'] },
  };

  // "visa egna medel": the source is a checkbox, so the answer is an array.
  const checkboxSource = {
    if: { properties: { finansiering: { contains: { const: 'EGNA_MEDEL' } } }, required: ['finansiering'] },
    then: { required: ['egnaMedel', 'bifogatKontoutdrag'] },
  };

  const schema: RJSFSchema = { type: 'object', allOf: [orOverAlternatives, checkboxSource] };
  const names = ['foretagsform', 'finansiering', 'bifogatRegisterutdrag', 'egnaMedel', 'bifogatKontoutdrag'];

  it('reveals a field for any of the allowed alternatives', () => {
    expect(visibleFields(schema, { foretagsform: 'HB' }, names)).toContain('bifogatRegisterutdrag');
    expect(visibleFields(schema, { foretagsform: 'EF' }, names)).not.toContain('bifogatRegisterutdrag');
  });

  it('reveals fields from a ticked checkbox option', () => {
    const visible = visibleFields(schema, { finansiering: ['BANKLAN', 'EGNA_MEDEL'] }, names);

    expect(visible).toContain('egnaMedel');
    expect(visible).toContain('bifogatKontoutdrag');
  });

  it('keeps unconditional fields visible', () => {
    expect(visibleFields(schema, {}, names)).toContain('foretagsform');
  });

  it('hides dependent fields before the source is answered', () => {
    const visible = visibleFields(schema, {}, names);

    expect(visible).not.toContain('bifogatRegisterutdrag');
    expect(visible).not.toContain('egnaMedel');
  });
});

describe('getConditionalFields', () => {
  it('ORs the conditions when two rules name the same field', () => {
    const schema: RJSFSchema = {
      type: 'object',
      allOf: [
        { if: { properties: { a: { const: 'x' } }, required: ['a'] }, then: { required: ['target'] } },
        { if: { properties: { b: { const: 'y' } }, required: ['b'] }, then: { required: ['target'] } },
      ],
    };

    expect(getConditionalFields(schema).get('target')).toHaveLength(2);
    expect(visibleFields(schema, { a: 'x' }, ['target'])).toContain('target');
    expect(visibleFields(schema, { b: 'y' }, ['target'])).toContain('target');
    expect(visibleFields(schema, { a: 'no', b: 'no' }, ['target'])).not.toContain('target');
  });

  it('reads a root-level if/then as well as allOf', () => {
    const schema: RJSFSchema = {
      type: 'object',
      if: { properties: { a: { const: 'x' } }, required: ['a'] },
      then: { required: ['target'] },
    };

    expect(visibleFields(schema, { a: 'x' }, ['target'])).toContain('target');
  });

  it('shows the field and warns when a condition uses a keyword the engine does not implement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const schema: RJSFSchema = {
      type: 'object',
      allOf: [{ if: { properties: { a: { pattern: '^x' } }, required: ['a'] }, then: { required: ['target'] } }],
    };

    expect(visibleFields(schema, { a: 'nope' }, ['target'])).toContain('target');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('pattern'));
  });
});

describe('stripHiddenFields', () => {
  const schema: RJSFSchema = {
    type: 'object',
    properties: {
      finansiering: { type: 'array' },
      egnaMedel: { type: 'string' },
      serveringsstalle: { type: 'object', properties: { namn: { type: 'string' } } },
    },
    allOf: [
      {
        if: { properties: { finansiering: { contains: { const: 'EGNA_MEDEL' } } }, required: ['finansiering'] },
        then: { required: ['egnaMedel'] },
      },
    ],
  };

  it('keeps the answer while the branch is visible', () => {
    const data = { finansiering: ['EGNA_MEDEL'], egnaMedel: '10 000' };

    expect(stripHiddenFields(schema, data)).toEqual(data);
  });

  it('drops the answer once the branch is abandoned', () => {
    const data = { finansiering: ['BANKLAN'], egnaMedel: '10 000' };

    expect(stripHiddenFields(schema, data)).toEqual({ finansiering: ['BANKLAN'] });
  });

  it('recurses into nested objects and leaves plain values alone', () => {
    const nested: RJSFSchema = {
      type: 'object',
      properties: {
        grupp: {
          type: 'object',
          properties: { val: { type: 'string' }, foljd: { type: 'string' } },
          allOf: [{ if: { properties: { val: { const: 'ja' } }, required: ['val'] }, then: { required: ['foljd'] } }],
        },
      },
    };

    expect(stripHiddenFields(nested, { grupp: { val: 'nej', foljd: 'kvar' } })).toEqual({ grupp: { val: 'nej' } });
    expect(stripHiddenFields(nested, { grupp: { val: 'ja', foljd: 'kvar' } })).toEqual({
      grupp: { val: 'ja', foljd: 'kvar' },
    });
  });

  it('does not invent keys the data never had', () => {
    expect(stripHiddenFields(schema, {})).toEqual({});
    expect(stripHiddenFields(schema, undefined)).toEqual({});
  });
});
