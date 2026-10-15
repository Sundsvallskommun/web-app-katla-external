import fs from 'node:fs';
import path from 'node:path';

import i18nConfig from '@app/i18nConfig';
import { localeFromPath, pathWithLocale, pathWithoutLocale } from '@app/locale-path';
import { describe, expect, it } from 'vitest';

const localesDir = path.join(process.cwd(), 'locales');

const flattenKeys = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null ?
    Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, `${prefix}${key}.`))
  : [prefix.slice(0, -1)];

const readNamespace = (locale: string, file: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(localesDir, locale, file), 'utf8'));

const namespaceFiles = fs.readdirSync(path.join(localesDir, i18nConfig.defaultLocale)).sort();
const translatedLocales = i18nConfig.locales.filter((locale) => locale !== i18nConfig.defaultLocale);

describe('Locale resources', () => {
  it('has a directory for every configured locale', () => {
    for (const locale of i18nConfig.locales) {
      expect(fs.existsSync(path.join(localesDir, locale)), `locales/${locale} saknas`).toBe(true);
    }
  });

  // Key drift between languages is silent at runtime: i18next falls back to Swedish and nobody
  // notices until a user sees the wrong language mid-flow.
  describe.each(translatedLocales)('%s', (locale) => {
    it('has exactly the same namespace files as the default locale', () => {
      expect(fs.readdirSync(path.join(localesDir, locale)).sort()).toEqual(namespaceFiles);
    });

    it.each(namespaceFiles)('has exactly the same keys as the default locale in %s', (file) => {
      const defaultKeys = flattenKeys(readNamespace(i18nConfig.defaultLocale, file)).sort();
      const localeKeys = flattenKeys(readNamespace(locale, file)).sort();

      expect(localeKeys).toEqual(defaultKeys);
    });

    it.each(namespaceFiles)('leaves no untranslated placeholder values in %s', (file) => {
      const values = JSON.stringify(readNamespace(locale, file));

      expect(values).not.toContain('TODO');
    });
  });
});

describe('localeFromPath', () => {
  it('reads a supported locale from the first path segment', () => {
    expect(localeFromPath('/en/oversikt')).toBe('en');
    expect(localeFromPath('/sv/oversikt')).toBe('sv');
  });

  it('falls back to the default locale when the path has no locale prefix', () => {
    // The default locale is not prefixed, so unprefixed paths are the normal case.
    expect(localeFromPath('/oversikt')).toBe(i18nConfig.defaultLocale);
    expect(localeFromPath('/')).toBe(i18nConfig.defaultLocale);
    expect(localeFromPath(null)).toBe(i18nConfig.defaultLocale);
    expect(localeFromPath(undefined)).toBe(i18nConfig.defaultLocale);
  });

  it('does not mistake a path segment that merely looks like a locale', () => {
    expect(localeFromPath('/de/oversikt')).toBe(i18nConfig.defaultLocale);
    expect(localeFromPath('/english/oversikt')).toBe(i18nConfig.defaultLocale);
  });
});

describe('pathWithoutLocale', () => {
  // The proxy compares protected routes against the stripped path. Miss the stripping and
  // /en/... stops matching the route list, skipping the auth check.
  it('strips a supported locale prefix', () => {
    expect(pathWithoutLocale('/en/oversikt')).toBe('/oversikt');
    expect(pathWithoutLocale('/sv/arende/KATLA-1')).toBe('/arende/KATLA-1');
    expect(pathWithoutLocale('/en/admin')).toBe('/admin');
  });

  it('leaves paths without a locale prefix untouched', () => {
    expect(pathWithoutLocale('/oversikt')).toBe('/oversikt');
    expect(pathWithoutLocale('/admin')).toBe('/admin');
    expect(pathWithoutLocale('/de/oversikt')).toBe('/de/oversikt');
  });

  it('normalises a bare locale prefix to the root path', () => {
    expect(pathWithoutLocale('/en')).toBe('/');
    expect(pathWithoutLocale('/')).toBe('/');
    expect(pathWithoutLocale(null)).toBe('/');
  });

  it('does not strip a segment that merely starts with a locale code', () => {
    expect(pathWithoutLocale('/energi')).toBe('/energi');
    expect(pathWithoutLocale('/svenska/oversikt')).toBe('/svenska/oversikt');
  });
});

describe('metadata path lookup', () => {
  // paths.json is keyed without a language prefix. x-path carries the prefix for every language
  // but the default, so without stripping the lookup misses on every English page and the title
  // falls back to the derived path ("En, Login").
  it('resolves the same paths.json key regardless of language', () => {
    const paths = JSON.parse(fs.readFileSync(path.join(localesDir, 'sv', 'paths.json'), 'utf8')) as Record<
      string,
      unknown
    >;

    for (const key of Object.keys(paths)) {
      expect(pathWithoutLocale(key)).toBe(key);
      for (const locale of translatedLocales) {
        expect(pathWithoutLocale(`/${locale}${key}`)).toBe(key);
      }
    }
  });
});

describe('pathWithLocale', () => {
  it('always adds an explicit prefix, including for the default locale', () => {
    // The prefix on the default locale is deliberate: the proxy rewrites NEXT_LOCALE from the
    // path and then strips it, which is what makes the choice stick.
    expect(pathWithLocale('/en/oversikt', 'sv')).toBe('/sv/oversikt');
    expect(pathWithLocale('/oversikt', 'sv')).toBe('/sv/oversikt');
  });

  it('replaces an existing locale prefix rather than stacking prefixes', () => {
    expect(pathWithLocale('/en/oversikt', 'en')).toBe('/en/oversikt');
    expect(pathWithLocale('/sv/arende/KATLA-1', 'en')).toBe('/en/arende/KATLA-1');
  });

  it('handles the root path without a trailing slash', () => {
    expect(pathWithLocale('/', 'en')).toBe('/en');
    expect(pathWithLocale('/sv', 'en')).toBe('/en');
    expect(pathWithLocale(null, 'en')).toBe('/en');
  });
});
