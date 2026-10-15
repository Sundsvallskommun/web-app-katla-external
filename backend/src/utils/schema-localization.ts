/**
 * Localisation of schema and ui schema.
 *
 * Display text lives in the ui schema, not the JSON schema, which holds only the data
 * definitions. Translations are therefore stored as an `x-i18n` block next to the Swedish
 * text and resolved here before the response goes out.
 *
 * Keeping them in the ui schema is deliberate: it is written with PUT and leaves the schema ID
 * untouched, while any change to the JSON schema requires a new version. Errands are pinned to
 * their schema ID, so fixing a translation must not create one.
 *
 * Verified against the jsonschema API in test: unknown keys like `x-i18n` survive in the ui
 * schema's stored value, at both field and root level.
 */

/** The key translations are stored under. Must never reach the response. */
export const LOCALE_EXTENSION_KEY = 'x-i18n';

export const DEFAULT_LOCALE = 'sv';
export const SUPPORTED_LOCALES = ['sv', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isSupportedLocale = (value: string): value is SupportedLocale => (SUPPORTED_LOCALES as readonly string[]).includes(value);

/**
 * Picks the first understandable language from an Accept-Language header. The frontend sends a
 * bare language code, but other clients may send the standard form ("en-GB,en;q=0.9"), so both
 * region and quality weight are tolerated. Unknown languages fall back to Swedish rather than
 * being rejected — a form must never stop loading because the language is unknown.
 */
export const localeFromAcceptLanguage = (header: string | undefined): SupportedLocale => {
  for (const part of (header ?? '').split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!tag || tag === '*') continue;

    if (isSupportedLocale(tag)) return tag;

    const base = tag.split('-')[0] ?? '';
    if (isSupportedLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
};

/**
 * Walks the structure and replaces every node carrying `x-i18n` with its translated variant.
 * The block is always removed, even when the language is missing — otherwise the Swedish text
 * and every other language would leak to the client as dead weight in each response.
 *
 * The merge is shallow per node: the translation block replaces whole keys such as `ui:title`.
 * That is enough for display text and keeps the result predictable.
 */
export const resolveLocaleExtensions = (value: unknown, locale: string): unknown => {
  if (Array.isArray(value)) {
    return value.map(entry => resolveLocaleExtensions(entry, locale));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === LOCALE_EXTENSION_KEY) continue;
    resolved[key] = resolveLocaleExtensions(entry, locale);
  }

  const translations = value[LOCALE_EXTENSION_KEY];
  if (isPlainObject(translations)) {
    const forLocale = translations[locale];
    if (isPlainObject(forLocale)) {
      for (const [key, entry] of Object.entries(forLocale)) {
        resolved[key] = resolveLocaleExtensions(entry, locale);
      }
    }
  }

  return resolved;
};

export const localizeUiSchema = (uiSchema: Record<string, unknown>, locale: string): Record<string, unknown> =>
  resolveLocaleExtensions(uiSchema, locale) as Record<string, unknown>;

/**
 * The JSON schema title is the only display text outside the ui schema, and it can only change
 * with a new schema version. It is therefore translated via a `ui:title` at the ui schema root,
 * written into the schema copy here. Without that step the form's error summary would name the
 * schema in Swedish inside an English interface.
 */
export const applyUiSchemaTitleToSchema = (schema: Record<string, unknown>, localizedUiSchema: Record<string, unknown>): Record<string, unknown> => {
  const uiTitle = localizedUiSchema['ui:title'];
  if (typeof uiTitle !== 'string' || uiTitle.trim().length === 0) {
    return schema;
  }

  return { ...schema, title: uiTitle };
};
