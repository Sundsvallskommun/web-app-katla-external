'use client';

import i18nConfig from '@app/i18nConfig';
import { pathWithLocale } from '@app/locale-path';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSwitch {
  currentLanguage: string;
  switchTo: (locale: string) => void;
}

/**
 * One source for the language switch, shared by every surface exposing it. Otherwise the
 * navigation is copied into each menu, and a surface that forgets a detail — the query string,
 * say — breaks silently until someone uses that particular menu.
 */
export const useLanguageSwitch = (): LanguageSwitch => {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentLanguage = i18n.resolvedLanguage ?? i18nConfig.defaultLocale;

  const switchTo = useCallback(
    (locale: string) => {
      // The query string carries state the page cannot rebuild: login reads ?path for where to
      // return to and ?failMessage for the error to show. A language switch that drops it sends
      // the user to the overview instead of the page they were trying to reach.
      const query = searchParams.toString();

      // Navigate with an explicit language prefix. The proxy rewrites the NEXT_LOCALE cookie
      // from the path and strips the prefix again for the default locale, so the choice does not
      // need writing to the cookie here.
      router.push(`${pathWithLocale(pathname, locale)}${query ? `?${query}` : ''}`);
    },
    [pathname, router, searchParams]
  );

  return { currentLanguage, switchTo };
};
