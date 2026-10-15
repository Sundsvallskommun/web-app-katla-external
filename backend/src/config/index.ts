import { config } from 'dotenv';

import { APIS } from './api-config';

export { APIS };

// An empty string must fall back to development, hence the explicit check.
const nodeEnv = process.env.NODE_ENV;
config({ path: `.env.${nodeEnv !== undefined && nodeEnv !== '' ? nodeEnv : 'development'}.local`, quiet: true });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const SWAGGER_ENABLED = process.env.SWAGGER_ENABLED === 'true';
export const SESSION_MEMORY = process.env.SESSION_MEMORY === 'true';

export const {
  APP_NAME,
  NODE_ENV,
  PORT,
  API_BASE_URL,
  LOG_FORMAT,
  LOG_DIR,
  ORIGIN,
  SECRET_KEY,
  CLIENT_KEY,
  CLIENT_SECRET,
  BASE_URL_PREFIX,
  ENVIRONMENT,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
  SAML_CALLBACK_URL,
  SAML_LOGOUT_URL,
  SAML_LOGOUT_CALLBACK_URL,
  SAML_SUCCESS_BASE,
  SAML_SUCCESS_REDIRECT,
  SAML_FAILURE_REDIRECT,
  SAML_FAILURE_REDIRECT_MESSAGE,
  SAML_LOGOUT_REDIRECT,
  SAML_ENTRY_SSO,
  SAML_AUDIENCE,
  SAML_ISSUER,
  SAML_IDP_PUBLIC_CERT,
  SAML_PRIVATE_KEY,
  SAML_PUBLIC_KEY,
  MUNICIPALITY_ID,
  SERVICE_NAMESPACES,
} = process.env;
