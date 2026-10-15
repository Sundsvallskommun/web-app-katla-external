'use client';

import { LinkButton } from '@components/navigation/link-button.component';
import { Button } from '@sk-web-gui/react';
import { capitalize } from 'lodash';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { servicePath } from 'src/constants/services';
import { useOverviewErrands } from 'src/hooks/use-overview-errands';
import { useService } from 'src/hooks/use-service';
import { useFilterStore } from 'src/stores/filter-store';

import { MainPageMobileHeader } from './main-page-mobile-header.component';
import { MobileErrandsList } from './mobile-errands-list.component';
import { MobileMenuBody } from './mobile-menu-body.component';

type OverlayType = 'menu' | null;

export const MobileOverviewLayout: React.FC = () => {
  const { t } = useTranslation();
  const service = useService();
  const [overlay, setOverlay] = useState<OverlayType>(null);
  const { activeStatus } = useFilterStore();
  const { rows, isLoading, hasMore, loadMore, totalElements, errandsError, metadataError } = useOverviewErrands({
    mode: 'mobile',
  });
  const errors = [metadataError, errandsError].filter((message): message is string => message !== null);

  const statusLabel = activeStatus ? capitalize(activeStatus) : capitalize(t('filtering:errands.open'));

  return (
    <>
      <MainPageMobileHeader
        actions={
          <Button
            iconButton
            variant="tertiary"
            aria-label={t('layout:controls.open_menu')}
            aria-controls={overlay === 'menu' ? 'mobile-overview-menu' : undefined}
            aria-expanded={overlay === 'menu'}
            onClick={() => {
              setOverlay('menu');
            }}
          >
            <Menu />
          </Button>
        }
      >
        <div className="px-24 py-12">
          <LinkButton href={servicePath(service)} color="vattjom" variant="primary" className="w-full">
            {t('filtering:new_errand_mobile')}
          </LinkButton>
        </div>

        <div className="px-24 pt-8 pb-12">
          <h2 className="text-h3-md">{statusLabel}</h2>
          {rows.length < totalElements && (
            <span className="text-small text-dark-secondary">
              Visar {rows.length} av {totalElements} {activeStatus ?? t('filtering:errands.open')}
            </span>
          )}
        </div>

        <MobileErrandsList rows={rows} isLoading={isLoading} hasMore={hasMore} loadMore={loadMore} errors={errors} />
      </MainPageMobileHeader>

      {overlay === 'menu' && (
        <MobileMenuBody
          onClose={() => {
            setOverlay(null);
          }}
        />
      )}
    </>
  );
};
