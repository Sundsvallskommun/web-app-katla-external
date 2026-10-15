'use client';

import { languageOptions } from '@components/misc/language-options';
import { PopupMenu, RadioButton } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';
import { useLanguageSwitch } from 'src/hooks/use-language-switch';

interface LanguageItemsProps {
  /**
   * The radio group's name. Two groups sharing a name on one page share selection, and the list
   * renders more than once (user menu and header button), so each place needs its own name.
   */
  name?: string;
  /** data-cy prefix, for the same reason as `name`: selectors must be unique per surface. */
  testIdPrefix?: string;
  /**
   * Runs just before navigation, for pages with state to save. The switch remounts the tree, so
   * anything living only in memory is gone afterwards.
   */
  onBeforeSwitch?: () => void;
}

export const LanguageItems: React.FC<LanguageItemsProps> = ({
  name = 'user-menu-language',
  testIdPrefix = 'language-option',
  onBeforeSwitch,
}) => {
  const { t } = useTranslation();
  const { currentLanguage, switchTo } = useLanguageSwitch();

  return (
    <PopupMenu.Items aria-label={t('layout:language.label')}>
      {languageOptions.map(({ value, labelKey }) => (
        <PopupMenu.Item key={value} closeOnClick={false}>
          <RadioButton
            name={name}
            value={value}
            data-cy={`${testIdPrefix}-${value}`}
            lang={value}
            onChange={() => {
              onBeforeSwitch?.();
              switchTo(value);
            }}
            checked={currentLanguage === value}
          >
            <span lang={value}>{t(labelKey)}</span>
          </RadioButton>
        </PopupMenu.Item>
      ))}
    </PopupMenu.Items>
  );
};
