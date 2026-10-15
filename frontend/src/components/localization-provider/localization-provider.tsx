'use client';

import initLocalization from '@app/i18n';
import { setDayjsLocale } from '@utils/dayjs-locale';
import { createInstance, Resource } from 'i18next';
import { memo, ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

interface LocalizationProviderProps {
  children: ReactNode;
  locale: string;
  namespaces: string[];
  resources: Resource;
}

const LocalizationProvider = memo<LocalizationProviderProps>(({ children, locale, namespaces, resources }) => {
  const i18n = createInstance();

  void initLocalization(locale, namespaces, i18n, resources);

  // The dayjs locale is a process global. Set during render it is shared between concurrent SSR
  // requests, so an English request could flip the language midway through rendering a Swedish
  // one. In an effect it runs only on the client, where the global belongs to one user.
  useEffect(() => {
    setDayjsLocale(locale);
  }, [locale]);

  return <I18nextProvider {...{ i18n }}>{children}</I18nextProvider>;
});

LocalizationProvider.displayName = 'LocalizationProvider';
export default LocalizationProvider;
