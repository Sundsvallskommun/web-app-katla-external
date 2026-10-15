import LocalizationProvider from '@components/localization-provider/localization-provider';
import { headers } from 'next/headers';
import { ReactNode } from 'react';

import initLocalization from '../i18n';
import { pathWithoutLocale } from '../locale-path';

/** Keeps the null case, which separates "no path" from the root path in the title logic. */
const pathWithoutLocaleOrNull = (path: string | null): string | null =>
  path === null ? null : pathWithoutLocale(path);

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

const namespaces = [
  'common',
  'paths',
  'layout',
  'login',
  'filtering',
  'errand-information',
  'session',
  'validation',
  'forms',
  'start',
];

const LocaleLayout = async ({ children, params }: LocaleLayoutProps) => {
  const { locale } = await params;
  const { resources } = await initLocalization(locale, namespaces);

  return <LocalizationProvider {...{ locale, resources, namespaces }}>{children}</LocalizationProvider>;
};

export const generateMetadata = async ({ params }: LocaleLayoutProps) => {
  const { locale } = await params;
  const { t } = await initLocalization(locale, namespaces);
  // Keys in paths.json are locale-independent, while x-path carries the locale prefix for every
  // language but the default. Without stripping it the lookup misses on every /en page and the
  // title falls back to the derived path ("En, Login").
  const path = pathWithoutLocaleOrNull((await headers()).get('x-path'));

  const pathName =
    !path ? null : (
      path
        .replace(/^\/?/, '') // Remove leading slash
        .split('/') // Split into sections
        .map(
          (s) =>
            `${s.substring(0, 1).toUpperCase()}${s.substring(1)}` // Capitalize the first letter
              .replace('-', ' ') // Replace separators
        )
        .join(', ')
    ); // Comma separate sections

  const title =
    path ?
      `${process.env.NEXT_PUBLIC_APP_NAME} - ${t(`paths:${path}.title`, { defaultValue: pathName })}`
    : process.env.NEXT_PUBLIC_APP_NAME;
  const description = t(`paths:${path}.description`, { defaultValue: '' });

  return {
    title,
    description,
  };
};

export default LocaleLayout;
