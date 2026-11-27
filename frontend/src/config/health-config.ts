import { timingSafeEqual } from 'node:crypto';

const DEFAULT_REQUEST_TIMEOUT_MS = 3_000;
const MAX_REQUEST_TIMEOUT_MS = 30_000;
type Environment = Readonly<Record<string, string | undefined>>;

type HealthAuthentication =
  | { enabled: false }
  | {
      enabled: true;
      expectedAuthorization: string;
    };

interface HealthConfig {
  authentication: HealthAuthentication;
  backendHealthUrl: string;
  requestTimeoutMs: number;
}

const parseAuthentication = (environment: Environment): HealthAuthentication => {
  const healthAuth = environment.HEALTH_AUTH ?? 'false';

  if (healthAuth !== 'true' && healthAuth !== 'false') {
    throw new Error('HEALTH_AUTH must be either "true" or "false"');
  }

  if (healthAuth === 'false') {
    return { enabled: false };
  }

  const username = environment.HEALTH_USERNAME ?? '';
  const password = environment.HEALTH_PASSWORD ?? '';

  if (!username || !password) {
    throw new Error('HEALTH_USERNAME and HEALTH_PASSWORD are required when HEALTH_AUTH is true');
  }

  const credentials = `${username}:${password}`;

  return {
    enabled: true,
    expectedAuthorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
  };
};

const parseBackendHealthUrl = (environment: Environment): string => {
  // An empty INTERNAL_API_URL falls back to the public URL, like a missing value.
  const configuredInternalUrl = environment.INTERNAL_API_URL?.trim() ?? '';
  const internalApiUrl =
    configuredInternalUrl !== '' ? configuredInternalUrl : (environment.NEXT_PUBLIC_API_URL?.trim() ?? '');

  if (!internalApiUrl) {
    throw new Error('INTERNAL_API_URL or NEXT_PUBLIC_API_URL is required');
  }

  const baseUrl = new URL(internalApiUrl.endsWith('/') ? internalApiUrl : `${internalApiUrl}/`);

  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('INTERNAL_API_URL must use http or https');
  }

  return new URL('health/up', baseUrl).toString();
};

const parseRequestTimeout = (environment: Environment): number => {
  const rawTimeout = environment.HEALTH_REQUEST_TIMEOUT_MS;

  if (rawTimeout === undefined || rawTimeout === '') {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const timeout = Number(rawTimeout);

  if (!/^\d+$/.test(rawTimeout) || !Number.isInteger(timeout) || timeout < 1 || timeout > MAX_REQUEST_TIMEOUT_MS) {
    throw new Error(`HEALTH_REQUEST_TIMEOUT_MS must be an integer between 1 and ${MAX_REQUEST_TIMEOUT_MS}`);
  }

  return timeout;
};

export const createHealthConfig = (environment: Environment): HealthConfig => ({
  authentication: parseAuthentication(environment),
  backendHealthUrl: parseBackendHealthUrl(environment),
  requestTimeoutMs: parseRequestTimeout(environment),
});

export const isHealthRequestAuthorized = (authorization: string | null, config: HealthConfig): boolean => {
  if (!config.authentication.enabled) {
    return true;
  }

  const suppliedAuthorization = Buffer.from(authorization ?? '');
  const expectedAuthorization = Buffer.from(config.authentication.expectedAuthorization);

  return (
    suppliedAuthorization.length === expectedAuthorization.length &&
    timingSafeEqual(suppliedAuthorization, expectedAuthorization)
  );
};
