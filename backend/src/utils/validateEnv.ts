import { cleanEnv, port, str, url } from 'envalid';

const EXAMPLE_SECRET = 'NffJVXQ7P2YqK37kEC3hcxywwaKNuv'; // shipped in .env.example.local
const RECOMMENDED_SECRET_LENGTH = 32; // ~256-bit when base64/hex

/**
 * Refuses to start a deployed instance that still signs sessions with the shipped example secret.
 * Enforced only under NODE_ENV=production (TEST and production both run that way); local
 * development may keep the template value.
 */
function validateSecretStrength(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const secret = (process.env.SECRET_KEY ?? '').trim();
  if (secret === EXAMPLE_SECRET) {
    console.error('\nInsecure SECRET_KEY: it is the shipped example value; set a strong unique secret.\n');
    process.exit(1);
  }
  if (secret.length < RECOMMENDED_SECRET_LENGTH) {
    console.warn(`⚠️  SECRET_KEY is shorter than the recommended ${RECOMMENDED_SECRET_LENGTH} characters.`);
  }
}

// NOTE: Make sure we got these in ENV
const validateEnv = () => {
  cleanEnv(process.env, {
    NODE_ENV: str(),
    SECRET_KEY: str(),
    API_BASE_URL: str(),
    CLIENT_KEY: str(),
    CLIENT_SECRET: str(),
    PORT: port(),
    BASE_URL_PREFIX: str(),
    ORIGIN: str(),
    SAML_CALLBACK_URL: url(),
    SAML_LOGOUT_CALLBACK_URL: url(),
    SAML_FAILURE_REDIRECT: url(),
    SAML_SUCCESS_REDIRECT: url(),
    SAML_ENTRY_SSO: url(),
    SAML_LOGOUT_URL: url(),
    SAML_ISSUER: str(),
    SAML_IDP_PUBLIC_CERT: str(),
    SAML_PRIVATE_KEY: str(),
    SAML_PUBLIC_KEY: str(),
    MUNICIPALITY_ID: str(),
    SERVICE_NAMESPACES: str(),
  });

  validateSecretStrength();
};

export default validateEnv;
