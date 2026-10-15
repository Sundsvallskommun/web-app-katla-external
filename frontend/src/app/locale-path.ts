import i18nConfig from './i18nConfig';

const isSupportedLocale = (value: string): boolean => i18nConfig.locales.includes(value);

const firstSegmentOf = (path: string): string => path.replace(/^\//, '').split('/')[0] ?? '';

/**
 * Paths here are always without basePath — both `nextUrl.pathname` in the proxy and
 * `usePathname()` on the client omit it, and `router.push()` puts it back.
 */

/**
 * Reads the language from the first path segment. The default locale has no prefix
 * (prefixDefault is off in next-i18n-router), so a path without a known language segment is
 * the default locale.
 */
export const localeFromPath = (path: string | null | undefined): string => {
  const firstSegment = firstSegmentOf(path ?? '');
  return isSupportedLocale(firstSegment) ? firstSegment : i18nConfig.defaultLocale;
};

/**
 * Strips any language prefix, for comparisons that must be locale-independent — without it a
 * list of protected routes would stop matching as soon as the path carries a prefix.
 */
export const pathWithoutLocale = (path: string | null | undefined): string => {
  const value = path ?? '';
  const firstSegment = firstSegmentOf(value);
  if (!isSupportedLocale(firstSegment)) return value || '/';
  return value.slice(`/${firstSegment}`.length) || '/';
};

/**
 * Builds the path to the same page in another language, always with an explicit prefix. The
 * prefix is kept even for the default locale: the proxy then rewrites the NEXT_LOCALE cookie and
 * strips it again, which is what makes the choice survive the next navigation.
 */
export const pathWithLocale = (path: string | null | undefined, locale: string): string => {
  const base = pathWithoutLocale(path);
  return `/${locale}${base === '/' ? '' : base}`;
};
