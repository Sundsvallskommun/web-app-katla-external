/** Anything but LOCAL or TEST — an unset value included — is production. */
export type Environment = 'LOCAL' | 'TEST' | 'PRODUCTION';

export interface AppConfig {
  applicationName: string;
  environment: Environment;
  features: AppConfigFeatures;
}

interface AppConfigFeatures {
  draftEnabled: boolean;
  errandFilter: boolean;
  reducedStakeholderInfo: boolean;
  disclosureDoneMark: boolean;
  otherPartiesDisclosure: boolean;
}

const readEnvironment = (value: string | undefined): Environment => {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized === 'LOCAL' || normalized === 'TEST' ? normalized : 'PRODUCTION';
};

export const appConfig: AppConfig = {
  applicationName: (process.env.NEXT_PUBLIC_APP_NAME ?? '') || 'appen',
  environment: readEnvironment(process.env.NEXT_PUBLIC_ENVIRONMENT),
  features: {
    draftEnabled: process.env.NEXT_PUBLIC_DRAFT_ERRAND === 'true',
    errandFilter: process.env.NEXT_PUBLIC_ERRAND_FILTER === 'true',
    reducedStakeholderInfo: process.env.NEXT_PUBLIC_REDUCED_STAKEHOLDER_INFO === 'true',
    disclosureDoneMark: process.env.NEXT_PUBLIC_DISCLOSURE_DONE_MARK === 'true',
    otherPartiesDisclosure: process.env.NEXT_PUBLIC_OTHER_PARTIES_DISCLOSURE === 'true',
  },
};

export const isProduction = (): boolean => appConfig.environment === 'PRODUCTION';
