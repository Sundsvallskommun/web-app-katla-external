const i18nConfig = {
  locales: ['sv', 'en'],
  defaultLocale: 'sv',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  // Language is an active choice, not a guess from Accept-Language. Some content (schema field
  // labels, statuses) still arrives from the APIs in Swedish only, so an English browser must not
  // land in a half-translated interface. The language switcher stores the choice in NEXT_LOCALE.
  localeDetector: false as const,
};

export default i18nConfig;
