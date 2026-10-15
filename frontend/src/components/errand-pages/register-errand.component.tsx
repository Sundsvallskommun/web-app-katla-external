'use client';

import { AboutErrand } from '@components/errand-sections/about-errand.component';
import { ErrandAttachments } from '@components/errand-sections/errand-attachments.component';
import { ErrandDetails } from '@components/errand-sections/errand-details.component';
import { ErrandOwner } from '@components/errand-sections/errand-owner.component';
import { OtherParties } from '@components/errand-sections/other-parties.component';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';

export const RegisterErrand: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-32">
      <h2 className="text-h2-md text-dark-primary">{t('errand-information:basic_information_heading')}</h2>
      <AboutErrand />
      <ErrandOwner />
      {appConfig.features.otherPartiesDisclosure && <OtherParties />}
      <h2 className="text-h2-md text-dark-primary">{t('errand-information:errand_details_heading')}</h2>
      <ErrandDetails />
      <ErrandAttachments />
    </div>
  );
};
