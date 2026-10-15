import i18nConfig from '@app/i18nConfig';

/**
 * The languages in display order, derived from the i18n config so a new language only has to be
 * added in one place.
 *
 * Names are written in the language itself ("English", not "Engelska") so a user who does not
 * read Swedish can find theirs. Each option also carries a lang attribute so screen readers
 * pronounce the name with the right voice.
 */
export const languageOptions = i18nConfig.locales.map((locale) => ({
  value: locale,
  labelKey: `layout:language.${locale}`,
}));
