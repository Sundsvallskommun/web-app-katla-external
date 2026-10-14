'use client';

import { StatusLabel } from '@components/misc/status-label.component';
import { LinkButton } from '@components/navigation/link-button.component';
import { ErrandDTO } from '@data-contracts/backend/data-contracts';
import { getTypeDisplayName } from '@utils/errand-helpers';
import dayjs from 'dayjs';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { errandPath } from 'src/constants/services';
import { useService } from 'src/hooks/use-service';

interface MobileErrandCardProps {
  errand: ErrandDTO;
}

export const MobileErrandCard: React.FC<MobileErrandCardProps> = ({ errand }) => {
  const { t } = useTranslation();
  const service = useService();
  const url = errandPath(service, errand.errandNumber);

  return (
    <div className="py-4">
      <div className="flex min-h-[8rem] items-end self-stretch rounded-[20px] border border-opacity-30 pt-[2.0rem] pb-[1.2rem] pl-[2.0rem] pr-[0.8rem] gap-4">
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <div className="w-fit">
            <StatusLabel status={errand.status} lifecycle={errand.lifecycle} />
          </div>

          <div className="text-xl font-bold lining-nums proportional-nums leading-[2.8rem] pt-[1.2rem] break-words">
            {getTypeDisplayName(errand)}
          </div>

          <div className="flex flex-col items-start gap-1.5 pt-[2.4rem] flex-1">
            <div className="text-base lining-nums proportional-nums leading-[2.4rem]">
              <span className="font-[700]">{t('common:errand-table.registered')}</span>{' '}
              {dayjs(errand.created).format('YYYY-MM-DD')}
            </div>
          </div>
        </div>

        <LinkButton
          href={url}
          aria-label={t('layout:controls.open_errand', { errandNumber: errand.errandNumber })}
          className="flex items-center justify-center p-[1.2rem]"
          iconButton
          size="lg"
          leftIcon={<ArrowRight aria-hidden="true" />}
          color="primary"
          variant="tertiary"
        />
      </div>
    </div>
  );
};
