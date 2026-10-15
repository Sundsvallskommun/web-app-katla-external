'use client';

import { PageHeader } from '@layouts/page-header.component';
import { Logo } from '@sk-web-gui/react';
import NextLink from 'next/link';
import { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface MainPageMobileHeaderProps {
  // Override the left-side icon.
  icon?: ReactElement;
  // Override the right-side action buttons.
  actions?: ReactNode;
  children?: ReactNode;
}

export const MainPageMobileHeader: React.FC<MainPageMobileHeaderProps> = ({ icon, actions, children }) => {
  const { t } = useTranslation();
  const headerIcon = icon ?? (
    <NextLink href="/" title={t('layout:controls.go_to_start', { app: process.env.NEXT_PUBLIC_APP_NAME })}>
      <Logo variant="symbol" className="h-32" />
    </NextLink>
  );

  // A JSX variable rather than a component created during render (static-components).
  const title = (
    <div className="flex items-center gap-12 py-8">
      {headerIcon}
      <strong className="text-large font-bold">{process.env.NEXT_PUBLIC_APP_NAME}</strong>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] pt-[env(safe-area-inset-top)]">
      <div className="flex-shrink-0 relative z-[15] bg-background-content">
        <PageHeader logo={title} mobileMenu={actions} />
      </div>
      <div className="flex-grow overflow-y-auto bg-background-100">{children}</div>
    </div>
  );
};
