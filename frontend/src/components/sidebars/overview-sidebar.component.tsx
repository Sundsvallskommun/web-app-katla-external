'use client';

import { LogoutButton } from '@components/buttons/logout-button.component';
import { AppUserMenu } from '@components/user-menu/app-user-menu.component';
import { createUserMenuGroups } from '@layouts/userMenuGroup';
import { useUserStore } from '@services/user-service/user-service';
import { Button, cx, Divider, Logo } from '@sk-web-gui/react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import NextLink from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { FilterOverviewSidebarStatusSelector } from './filter-overview-sidebar-status-selector.component';

export const OverviewSidebar: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(true);
  const userMenuGroups = createUserMenuGroups(t);

  const user = useUserStore(useShallow((s) => s.user));

  // A JSX variable rather than a component created during render (static-components).
  const sidebarLogo = (
    <NextLink
      href="/"
      className="no-underline"
      aria-label={t('layout:controls.go_to_start', { app: process.env.NEXT_PUBLIC_APP_NAME })}
    >
      <Logo
        className={cx(open ? '' : 'w-[2.8rem]')}
        variant={open ? 'service' : 'symbol'}
        title={'Registrering'}
        subtitle={process.env.NEXT_PUBLIC_APP_NAME}
      />
    </NextLink>
  );
  return (
    <>
      <aside
        data-cy="overview-aside"
        className={cx(
          'sticky transition-all ease-in-out duration-150 flex flex-col bg-vattjom-background-200 min-h-screen',
          open ? 'max-lg:shadow-100 sm:w-[32rem] sm:min-w-[32rem]' : 'w-[5.6rem]'
        )}
      >
        <div className={cx('h-full w-full', open ? 'p-24' : '')}>
          <div className={cx('mb-24', open ? '' : 'flex flex-col items-center justify-center pt-[1rem]')}>
            {sidebarLogo}
          </div>
          {/* The row holds only the user block, which is hidden when collapsed, so the row is
              dropped entirely rather than left as an empty spacer. */}
          {open && (
            <div className="h-fit pb-24 flex gap-12 items-center">
              <AppUserMenu
                data-cy="avatar-aside"
                initials={user.initials}
                menuTitle={user.name}
                menuGroups={userMenuGroups}
                buttonSize="md"
                className="flex-shrink-0"
                buttonRounded={false}
              />
              <span className="leading-tight h-fit font-bold mb-0" data-cy="userinfo">
                {user.name}
              </span>
            </div>
          )}
          <Divider className={cx(open ? '' : 'w-[4rem] mx-auto')} />
          <div className={cx('flex flex-col gap-8', open ? 'py-24' : 'items-center justify-center py-15')}>
            <FilterOverviewSidebarStatusSelector smallSideBar={!open} />
          </div>
          <Divider className={cx(open ? '' : 'w-[4rem] mx-auto')} />
          <div className="py-10 w-full ">
            <LogoutButton smallSideBar={!open} data-cy="logout-button" />
          </div>
          <div
            className={cx('absolute bottom-[2.4rem]', open ? 'right-[2.4rem]' : 'left-1/2 transform -translate-x-1/2')}
          >
            <Button
              color="primary"
              size={'md'}
              variant="tertiary"
              aria-label={open ? t('layout:controls.close_sidebar') : t('layout:controls.open_sidebar')}
              iconButton
              leftIcon={open ? <ChevronsLeft /> : <ChevronsRight />}
              onClick={() => {
                setOpen(!open);
              }}
            />
          </div>
        </div>
      </aside>
    </>
  );
};
