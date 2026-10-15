'use client';

import { LogoutButton } from '@components/buttons/logout-button.component';
import { colorSchemeOptions } from '@components/misc/color-scheme-options';
import { languageOptions } from '@components/misc/language-options';
import { FilterOverviewSidebarStatusSelector } from '@components/sidebars/filter-overview-sidebar-status-selector.component';
import { useUserStore } from '@services/user-service/user-service';
import { Avatar, Button, Divider, RadioButton } from '@sk-web-gui/react';
import { useLocalStorage } from '@utils/use-localstorage.hook';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageSwitch } from 'src/hooks/use-language-switch';
import { useShallow } from 'zustand/react/shallow';

import { MainPageMobileHeader } from './main-page-mobile-header.component';

interface MobileMenuBodyProps {
  onClose: () => void;
}

export const MobileMenuBody: React.FC<MobileMenuBodyProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const user = useUserStore(useShallow((s) => s.user));
  const { colorScheme, setColorScheme } = useLocalStorage();
  const { currentLanguage, switchTo } = useLanguageSwitch();

  return (
    <section
      id="mobile-overview-menu"
      aria-label={t('filtering:menu_title')}
      className="fixed inset-0 z-50 bg-background-content pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <MainPageMobileHeader
        actions={
          <Button iconButton variant="tertiary" aria-label={t('layout:controls.close_menu')} onClick={onClose}>
            <X />
          </Button>
        }
      >
        <div className="flex flex-col gap-16 px-24 py-16">
          <div className="flex items-center gap-12">
            <Avatar initials={user.initials} size="md" />
            <div className="flex flex-col">
              <span className="font-bold text-base">{user.name}</span>
            </div>
          </div>

          <Divider />

          <div className="flex flex-col gap-8">
            <FilterOverviewSidebarStatusSelector smallSideBar={false} />
          </div>

          <Divider />

          <div className="flex flex-col gap-8">
            <span id="mobile-color-scheme-label" className="text-small font-bold">
              {t('layout:color_scheme.label')}
            </span>
            <RadioButton.Group
              aria-labelledby="mobile-color-scheme-label"
              className="flex gap-8"
              name="mobile-color-scheme"
              value={colorScheme}
            >
              {colorSchemeOptions.map(({ value, labelKey, icon: Icon }) => (
                <RadioButton
                  key={value}
                  value={value}
                  checked={colorScheme === value}
                  onChange={() => {
                    setColorScheme(value);
                  }}
                >
                  <Icon aria-hidden="true" className={colorScheme === value ? '' : 'opacity-50'} size={16} />{' '}
                  {t(labelKey)}
                </RadioButton>
              ))}
            </RadioButton.Group>
          </div>

          <Divider />

          <div className="flex flex-col gap-8">
            <span id="mobile-language-label" className="text-small font-bold">
              {t('layout:language.label')}
            </span>
            <RadioButton.Group
              aria-labelledby="mobile-language-label"
              className="flex gap-8"
              name="mobile-language"
              value={currentLanguage}
            >
              {languageOptions.map(({ value, labelKey }) => (
                <RadioButton
                  key={value}
                  value={value}
                  lang={value}
                  data-cy={`mobile-language-option-${value}`}
                  checked={currentLanguage === value}
                  onChange={() => {
                    switchTo(value);
                  }}
                >
                  <span lang={value}>{t(labelKey)}</span>
                </RadioButton>
              ))}
            </RadioButton.Group>
          </div>

          <Divider />

          <LogoutButton smallSideBar={false} />
        </div>
      </MainPageMobileHeader>
    </section>
  );
};
