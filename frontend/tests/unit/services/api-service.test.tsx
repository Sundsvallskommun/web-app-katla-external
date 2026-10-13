import { ApiResponse, handleError, requestOptions } from '@services/api-service';
import type { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Api service', () => {
  beforeEach(() => {
    // jsdom does not allow window.location to be replaced, but pathname can be set via history.
    window.history.replaceState({}, '', '/dashboard');
  });

  it('should throw the error', () => {
    const error = {
      response: {
        status: 401,
        data: {
          message: 'Unauthorized',
        },
      },
      config: {},
    } as AxiosError<ApiResponse>;

    expect(() => handleError(error)).toThrow();
  });

  it('should throw an error with a different status code', () => {
    const error = {
      response: {
        status: 500,
        data: {
          message: 'Server Error',
        },
      },
      config: {},
    } as AxiosError<ApiResponse>;

    expect(() => handleError(error)).toThrow();
  });

  it('should throw an error with no response data', () => {
    const error = {
      request: {},
      message: 'Network Error',
      config: {},
    } as AxiosError<ApiResponse>;

    expect(() => handleError(error)).toThrow();
  });
});

describe('Api service route guard', () => {
  const unauthorized = {
    response: { status: 401, data: { message: 'NOT_AUTHORIZED' } },
    config: {},
  } as AxiosError<ApiResponse>;

  const origin = 'http://dev.test:3100';

  // The guard reads the env at import time, so each case needs a fresh module.
  const loadLoginRedirectUrl = async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/registrering/aot');
    vi.stubEnv('NEXT_PUBLIC_PROTECTED_ROUTES', '/oversikt,/alkoholtillstand');
    return (await import('@services/api-service')).loginRedirectUrl;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends an unauthenticated visitor to the login page rather than leaving the page half rendered', async () => {
    const loginRedirectUrl = await loadLoginRedirectUrl();

    const target = loginRedirectUrl(
      unauthorized,
      '/registrering/aot/alkoholtillstand/arende/AOT-26090002/grundinformation',
      origin
    );

    expect(target?.pathname).toBe('/registrering/aot/login');
    expect(target?.searchParams.get('path')).toBe(
      '/registrering/aot/alkoholtillstand/arende/AOT-26090002/grundinformation'
    );
    expect(target?.searchParams.get('failMessage')).toBe('NOT_AUTHORIZED');
  });

  it('guards a page reached with a language prefix too', async () => {
    const loginRedirectUrl = await loadLoginRedirectUrl();

    expect(loginRedirectUrl(unauthorized, '/registrering/aot/en/oversikt', origin)?.pathname).toBe(
      '/registrering/aot/login'
    );
  });

  it('leaves a public page alone', async () => {
    const loginRedirectUrl = await loadLoginRedirectUrl();

    expect(loginRedirectUrl(unauthorized, '/registrering/aot/login', origin)).toBeUndefined();
    expect(loginRedirectUrl(unauthorized, '/registrering/aot', origin)).toBeUndefined();
  });

  it('leaves anything that is not a 401 to the caller', async () => {
    const loginRedirectUrl = await loadLoginRedirectUrl();
    const serverError = {
      response: { status: 500, data: { message: 'Server Error' } },
      config: {},
    } as AxiosError<ApiResponse>;

    expect(loginRedirectUrl(serverError, '/registrering/aot/oversikt', origin)).toBeUndefined();
  });

  it('redirects nowhere while the protected route list is empty', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/registrering/aot');
    vi.stubEnv('NEXT_PUBLIC_PROTECTED_ROUTES', '');
    const { loginRedirectUrl } = await import('@services/api-service');

    expect(loginRedirectUrl(unauthorized, '/registrering/aot/oversikt', origin)).toBeUndefined();
  });
});

describe('Api service request options', () => {
  it('names the form of the current page so the backend can pick its namespace', () => {
    expect(requestOptions(undefined, '/alkoholtillstand/arende/AOT-26090002/grundinformation').headers).toMatchObject({
      'x-service-key': 'alkoholtillstand',
      'Content-Type': 'application/json',
    });
  });

  it('sends no form header outside a form', () => {
    expect(requestOptions(undefined, '/login').headers).not.toHaveProperty('x-service-key');
  });

  it('keeps caller headers replacing the defaults, as an upload relies on', () => {
    const headers = requestOptions({ headers: {} }, '/en/alkoholtillstand').headers;

    expect(headers).toMatchObject({ 'x-service-key': 'alkoholtillstand' });
    expect(headers).not.toHaveProperty('Content-Type');
  });
});
