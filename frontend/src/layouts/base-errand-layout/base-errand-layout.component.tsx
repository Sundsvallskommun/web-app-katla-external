import { pathWithoutLocale } from '@app/locale-path';
import { LanguageSwitchButton } from '@components/misc/language-switch-button.component';
import { StatusLabel } from '@components/misc/status-label.component';
import { LinkButton } from '@components/navigation/link-button.component';
import { AppUserMenu } from '@components/user-menu/app-user-menu.component';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { PageHeader } from '@layouts/page-header.component';
import { createUserMenuGroups } from '@layouts/userMenuGroup';
import { useUserStore } from '@services/user-service/user-service';
import { Divider, Link, Logo, PopupMenu } from '@sk-web-gui/react';
import { storeErrandFormHandover } from '@utils/errand-form-handover';
import { Menu } from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';
import { servicePath } from 'src/constants/services';
import { useService } from 'src/hooks/use-service';
import { useWizardStore } from 'src/stores/wizard-store';

interface BaseErrandLayoutProps {
  children: React.ReactNode;
  registerNewErrand: boolean;
}

export default function BaseErrandLayout({ children, registerNewErrand }: BaseErrandLayoutProps) {
  const user = useUserStore((s) => s.user);
  const { getValues, watch } = useFormContext<ErrandFormDTO>();
  const { t } = useTranslation();
  const service = useService();
  const pathname = usePathname();

  // The header is the only place that both owns the language choice and sees the form, so the
  // handover has to be written here. The key is the path without language prefix: the same page
  // in another language gives the same key, which is exactly the navigation that must survive.
  const saveFormBeforeLanguageSwitch = useCallback(() => {
    storeErrandFormHandover({
      path: pathWithoutLocale(pathname),
      values: getValues(),
      wizardStep: useWizardStore.getState().currentStep,
    });
  }, [getValues, pathname]);

  const userMenuGroups = createUserMenuGroups(t, { onBeforeLanguageSwitch: saveFormBeforeLanguageSwitch });

  const errandNumber = watch('errandNumber');
  const status = watch('status');
  const lifecycle = watch('lifecycle');

  // A JSX variable rather than a component created during render (static-components).
  const singleErrandTitle = (
    <div className="flex items-center gap-12 md:gap-24 py-8 md:py-10">
      <NextLink href="/" title={t('layout:controls.go_to_start', { app: process.env.NEXT_PUBLIC_APP_NAME })}>
        <Logo variant="symbol" className="h-32 md:h-40" />
      </NextLink>
      <span className="text-large">
        {registerNewErrand ?
          <strong className="text-large ml-8 font-bold">{appConfig.applicationName}</strong>
        : <>
            <StatusLabel status={status} lifecycle={lifecycle} />
            <span className="ml-8 text-small">{errandNumber}</span>
          </>
        }
      </span>
    </div>
  );

  return (
    <>
      <div className="bg-background-100 h-screen min-h-screen max-h-screen overflow-hidden w-full flex flex-col">
        <div className="relative z-[15] bg-background-content">
          <PageHeader
            logo={singleErrandTitle}
            userMenu={
              <div className="flex items-center h-fit">
                <LanguageSwitchButton onBeforeSwitch={saveFormBeforeLanguageSwitch} />
                <Divider orientation="vertical" className="mx-16" />
                <div data-cy="usermenu">
                  <AppUserMenu
                    initials={user.initials}
                    menuTitle={user.name}
                    menuSubTitle=""
                    menuGroups={userMenuGroups}
                    buttonRounded={false}
                    buttonSize="sm"
                  />
                </div>

                {!registerNewErrand && (
                  <>
                    <Divider orientation="vertical" className="mx-24" />
                    <LinkButton
                      href={servicePath(service)}
                      data-cy="register-new-errand-button"
                      color="primary"
                      variant="tertiary"
                    >
                      {t('filtering:new_errand')}
                    </LinkButton>
                  </>
                )}
              </div>
            }
            mobileMenu={
              <div className="flex items-center gap-8">
                <LanguageSwitchButton onBeforeSwitch={saveFormBeforeLanguageSwitch} />
                {!registerNewErrand && (
                  <div className="relative">
                    <PopupMenu align="end">
                      <PopupMenu.Button iconButton aria-label={t('layout:controls.open_menu')}>
                        <Menu />
                      </PopupMenu.Button>
                      <PopupMenu.Panel>
                        <PopupMenu.Group>
                          <div className="font-bold">{user.name}</div>
                        </PopupMenu.Group>
                        <PopupMenu.Items>
                          <PopupMenu.Group>
                            <PopupMenu.Item>
                              <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH}${servicePath(service)}`}>
                                {t('filtering:new_errand')}
                              </Link>
                            </PopupMenu.Item>
                          </PopupMenu.Group>

                          {userMenuGroups.map((group, groupindex) => (
                            <PopupMenu.Group key={`mobilegroup-${groupindex}`}>
                              {group.elements.map((item, itemindex) => (
                                <PopupMenu.Item key={`mobilegroup-${groupindex}-${itemindex}`}>
                                  {item.element()}
                                </PopupMenu.Item>
                              ))}
                            </PopupMenu.Group>
                          ))}
                        </PopupMenu.Items>
                      </PopupMenu.Panel>
                    </PopupMenu>
                  </div>
                )}
              </div>
            }
          />
        </div>

        {children}
      </div>
    </>
  );
}
