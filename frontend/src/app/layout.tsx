import '@styles/tailwind.scss';

import AppLayout from '@layouts/app/app-layout.component';
import { headers } from 'next/headers';
import { ReactNode, Suspense } from 'react';

import { localeFromPath } from './locale-path';

const RootLayout = async ({ children }: { children: ReactNode }) => {
  // The root layout sits above [locale] and so has no locale param. The proxy sets x-path on the
  // request, so the language is derived from the first path segment rather than pinned to the
  // default — otherwise English pages would declare lang="sv" to screen readers.
  const locale = localeFromPath((await headers()).get('x-path'));

  return (
    <html lang={locale}>
      <body>
        <Suspense>
          <AppLayout>{children}</AppLayout>
        </Suspense>
      </body>
    </html>
  );
};

export default RootLayout;
