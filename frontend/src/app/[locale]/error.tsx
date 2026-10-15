'use client';

import { CenterDiv } from '@layouts/center-div.component';
import Main from '@layouts/main/main.component';
import { Button } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';

/**
 * Route-level boundary for errors thrown during render. Schemas are maintained in the jsonschema
 * service and reach the renderer with no build step in between, so an unexpected shape must
 * degrade to a message and a retry, not a blank page.
 */
export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation('common');

  return (
    <Main>
      <CenterDiv>
        <div className="flex w-full max-w-screen-desktop-max flex-col items-start gap-16 py-32">
          <h1 className="text-h2-sm sm:text-h2-md">{t('render_error.title')}</h1>
          <p>{t('render_error.description')}</p>
          <Button onClick={reset}>{t('render_error.retry')}</Button>
        </div>
      </CenterDiv>
    </Main>
  );
}
