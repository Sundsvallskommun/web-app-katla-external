'use client';

import { Link } from '@sk-web-gui/react';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import { SERVICE_KEYS, servicePath } from 'src/constants/services';

export const StartContent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-32 w-full px-16 md:px-40">
      <div className="flex flex-col gap-8">
        <h1 className="text-h2-sm lg:text-h2-lg m-0">{t('start:title')}</h1>
        <p className="m-0">{t('start:intro')}</p>
      </div>
      <ul className="list-none m-0 p-0 flex flex-col gap-24">
        {SERVICE_KEYS.map((service) => (
          <li key={service} className="flex flex-col gap-4">
            <Link as={NextLink} href={servicePath(service)} size="lg" strong data-cy={`service-link-${service}`}>
              {t(`start:services.${service}.title`)}
            </Link>
            <p className="m-0">{t(`start:services.${service}.description`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
