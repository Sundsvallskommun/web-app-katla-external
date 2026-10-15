import { describe, expect, it } from 'vitest';

import { applyUiSchemaTitleToSchema, localeFromAcceptLanguage, localizeUiSchema, resolveLocaleExtensions } from '@/utils/schema-localization';

/** Extract from the real ui schema for 2281_avvikelse-plats-handelse_1.3, with x-i18n added. */
const uiSchema = () => ({
  'ui:title': 'Plats och händelseförlopp',
  'x-i18n': { en: { 'ui:title': 'Location and sequence of events' } },
  eventDate: {
    'ui:widget': 'date',
    'ui:title': 'När upptäcktes händelsen?',
    'ui:description': 'Vilket datum upptäcktes händelsen?',
    'ui:placeholder': 'Välj datum',
    'ui:options': { descriptionBelow: true },
    'x-i18n': {
      en: {
        'ui:title': 'When was the event discovered?',
        'ui:description': 'On what date was the event discovered?',
        'ui:placeholder': 'Select a date',
      },
    },
  },
  eventTime: {
    'ui:widget': 'time',
    'ui:title': 'Tid',
    'x-i18n': { en: { 'ui:title': 'Time' } },
  },
  'ui:order': ['eventDate', 'eventTime'],
  'ui:sections': [
    {
      id: 'uppgifter',
      title: 'Uppgifter kring avvikelsen',
      icon: 'clipboard-pen-line',
      fields: ['eventDate', 'eventTime'],
      'x-i18n': { en: { title: 'Details about the deviation' } },
    },
  ],
});

describe('localeFromAcceptLanguage', () => {
  it('accepts the bare locale the frontend sends', () => {
    expect(localeFromAcceptLanguage('en')).toBe('en');
    expect(localeFromAcceptLanguage('sv')).toBe('sv');
  });

  it('accepts standard header forms with region and quality values', () => {
    expect(localeFromAcceptLanguage('en-GB,en;q=0.9,sv;q=0.8')).toBe('en');
    expect(localeFromAcceptLanguage('sv-SE')).toBe('sv');
  });

  it('picks the first supported language and skips ones we do not have', () => {
    expect(localeFromAcceptLanguage('de,fr;q=0.9,en;q=0.8')).toBe('en');
  });

  // An unknown language must never stop a form from loading.
  it('falls back to Swedish for missing, empty or unsupported headers', () => {
    expect(localeFromAcceptLanguage(undefined)).toBe('sv');
    expect(localeFromAcceptLanguage('')).toBe('sv');
    expect(localeFromAcceptLanguage('*')).toBe('sv');
    expect(localeFromAcceptLanguage('de-DE,fr')).toBe('sv');
  });
});

describe('localizeUiSchema', () => {
  it('replaces display text with the requested language', () => {
    const result = localizeUiSchema(uiSchema(), 'en');

    expect(result['ui:title']).toBe('Location and sequence of events');
    expect(result.eventDate).toMatchObject({
      'ui:title': 'When was the event discovered?',
      'ui:description': 'On what date was the event discovered?',
      'ui:placeholder': 'Select a date',
    });
    expect(result.eventTime).toMatchObject({ 'ui:title': 'Time' });
  });

  it('translates ui:sections, which RJSF does not know about', () => {
    const [section] = localizeUiSchema(uiSchema(), 'en')['ui:sections'] as Record<string, unknown>[];

    expect(section).toMatchObject({ id: 'uppgifter', title: 'Details about the deviation' });
  });

  it('keeps everything that is not display text untouched', () => {
    const result = localizeUiSchema(uiSchema(), 'en');
    const [section] = result['ui:sections'] as Record<string, unknown>[];

    expect(result.eventDate).toMatchObject({ 'ui:widget': 'date', 'ui:options': { descriptionBelow: true } });
    expect(result['ui:order']).toEqual(['eventDate', 'eventTime']);
    expect(section).toMatchObject({ icon: 'clipboard-pen-line', fields: ['eventDate', 'eventTime'] });
  });

  it('keeps the Swedish base text when the language has no translation', () => {
    const result = localizeUiSchema(uiSchema(), 'sv');

    expect(result['ui:title']).toBe('Plats och händelseförlopp');
    expect(result.eventDate).toMatchObject({ 'ui:title': 'När upptäcktes händelsen?' });
  });

  it('falls back to the base text for a language nobody has translated', () => {
    const result = localizeUiSchema(uiSchema(), 'de');

    expect(result.eventTime).toMatchObject({ 'ui:title': 'Tid' });
  });

  // The block carries every language. Leaking it grows each response with text nobody reads,
  // and the frontend could render the wrong language from it.
  it.each(['sv', 'en', 'de'])('never leaks the x-i18n block for locale %s', locale => {
    const serialized = JSON.stringify(localizeUiSchema(uiSchema(), locale));

    expect(serialized).not.toContain('x-i18n');
  });

  it('leaves a ui-schema without translations completely unchanged', () => {
    const plain = { eventTime: { 'ui:widget': 'time', 'ui:title': 'Tid' }, 'ui:order': ['eventTime'] };

    expect(localizeUiSchema(plain, 'en')).toEqual(plain);
  });

  it('does not mutate the input', () => {
    const input = uiSchema();
    localizeUiSchema(input, 'en');

    expect(input.eventTime['x-i18n']).toBeDefined();
    expect(input.eventTime['ui:title']).toBe('Tid');
  });
});

describe('resolveLocaleExtensions', () => {
  it('resolves translations at any depth, not just the top level', () => {
    const nested = { a: { b: { c: { label: 'svenska', 'x-i18n': { en: { label: 'english' } } } } } };

    expect(resolveLocaleExtensions(nested, 'en')).toEqual({ a: { b: { c: { label: 'english' } } } });
  });

  it('passes primitives and empty structures through', () => {
    expect(resolveLocaleExtensions('text', 'en')).toBe('text');
    expect(resolveLocaleExtensions(null, 'en')).toBeNull();
    expect(resolveLocaleExtensions([], 'en')).toEqual([]);
  });

  // A broken or half-written translation must not bring the whole form down.
  it('ignores a malformed x-i18n block instead of failing', () => {
    expect(resolveLocaleExtensions({ title: 'Tid', 'x-i18n': 'trasig' }, 'en')).toEqual({ title: 'Tid' });
    expect(resolveLocaleExtensions({ title: 'Tid', 'x-i18n': { en: 'trasig' } }, 'en')).toEqual({ title: 'Tid' });
  });
});

describe('applyUiSchemaTitleToSchema', () => {
  // The schema title names the form in the error summary. It lives in the JSON schema and only
  // changes with a new version, so it is translated via the ui schema root instead.
  it('takes the localized root title from the ui-schema', () => {
    const schema = applyUiSchemaTitleToSchema(
      { type: 'object', title: 'Plats och händelseförlopp' },
      {
        'ui:title': 'Location and sequence of events',
      },
    );

    expect(schema).toEqual({ type: 'object', title: 'Location and sequence of events' });
  });

  it('keeps the schema title when the ui-schema has no usable root title', () => {
    const schema = { type: 'object', title: 'Plats och händelseförlopp' };

    expect(applyUiSchemaTitleToSchema(schema, {})).toEqual(schema);
    expect(applyUiSchemaTitleToSchema(schema, { 'ui:title': '   ' })).toEqual(schema);
    expect(applyUiSchemaTitleToSchema(schema, { 'ui:title': 42 })).toEqual(schema);
  });

  it('does not mutate the schema it is given', () => {
    const schema = { type: 'object', title: 'Plats och händelseförlopp' };
    applyUiSchemaTitleToSchema(schema, { 'ui:title': 'Location and sequence of events' });

    expect(schema.title).toBe('Plats och händelseförlopp');
  });
});
