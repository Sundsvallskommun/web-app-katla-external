'use client';

import { LanguageItems } from '@components/misc/language-items.component';
import { PopupMenu } from '@sk-web-gui/react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageSwitch } from 'src/hooks/use-language-switch';

/**
 * The language choice as its own header control. The menu under the user avatar is not enough:
 * it is hidden on narrow screens, and registration has no menu at all, which would leave leaving
 * the page as the only way to switch.
 *
 * The button shows the selected language's code, while the accessible name spells the language
 * out — a code means nothing to someone who does not already recognise it.
 */
interface LanguageSwitchButtonProps {
  /** See `LanguageItems`: pages with in-memory state get to save it before navigating. */
  onBeforeSwitch?: () => void;
}

export const LanguageSwitchButton: React.FC<LanguageSwitchButtonProps> = ({ onBeforeSwitch }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguageSwitch();

  return (
    // The design system gives the panel `position: absolute` and only `right: 0`; its vertical
    // placement comes from its static position, where it would have landed in normal flow after
    // the button. The wrapper must therefore be a plain block: inside a flex container with
    // `items-center` that static position is centred on the button instead and the panel covers
    // the header. `relative` also measures `right: 0` against the button, not the whole row.
    <div className="relative">
      <PopupMenu align="end">
        <PopupMenu.Button
          variant="tertiary"
          size="sm"
          showBackground={false}
          data-cy="language-switch-button"
          aria-label={t('layout:language.switch', { language: t(`layout:language.${currentLanguage}`) })}
          leftIcon={<Languages aria-hidden="true" size={18} />}
        >
          <span aria-hidden="true">{currentLanguage.toLocaleUpperCase(currentLanguage)}</span>
        </PopupMenu.Button>
        <PopupMenu.Panel>
          <LanguageItems name="header-language" testIdPrefix="header-language-option" onBeforeSwitch={onBeforeSwitch} />
        </PopupMenu.Panel>
      </PopupMenu>
    </div>
  );
};
