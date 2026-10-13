'use client';

import { ErrandFilterQuery } from '@components/filtering/errand-filter-query.component';
import Filtering from '@components/filtering/filtering.component';
import { LinkButton } from '@components/navigation/link-button.component';
import { Button } from '@sk-web-gui/react';
import { ListFilter } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';
import { servicePath } from 'src/constants/services';
import { useService } from 'src/hooks/use-service';

export const ErrandFilter: React.FC = () => {
  const service = useService();
  const { t } = useTranslation();
  const [show, setShow] = useState<boolean>(false);

  return (
    <>
      <div className="w-full flex gap-16 max-w-screen-desktop-max items-center">
        <ErrandFilterQuery />
        {appConfig.features.errandFilter && (
          <Button
            aria-controls={show ? 'errand-filter-panel' : undefined}
            aria-expanded={show}
            onClick={() => {
              setShow(!show);
            }}
            data-cy="Show-filters-button"
            color="vattjom"
            variant={show ? 'tertiary' : 'primary'}
            inverted={show ? false : true}
            leftIcon={<ListFilter size="1.8rem" />}
          >
            {show ? t('filtering:hide_filter') : t('filtering:show_filter')}
          </Button>
        )}
        <LinkButton href={servicePath(service)} data-cy="register-new-errand-button" color="vattjom" variant="primary">
          {t('filtering:new_errand')}
        </LinkButton>
      </div>

      {show && (
        <section id="errand-filter-panel" aria-label={t('filtering:filter_panel')}>
          <Filtering />
        </section>
      )}
    </>
  );
};
