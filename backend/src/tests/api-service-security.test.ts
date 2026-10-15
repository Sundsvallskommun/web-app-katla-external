import type { AxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { HttpException } from '@/exceptions/HttpException';
import ApiService, { NO_SESSION_SENDER } from '@/services/api.service';
import ApiTokenService from '@/services/api-token.service';
import { logger } from '@/utils/logger';

import { mockCitizenPartyId } from './helpers/mock-data';

const citizenSender = { user: { partyId: mockCitizenPartyId } };

const axiosMocks = vi.hoisted(() => ({
  isAxiosError: vi.fn<(error: unknown) => boolean>(),
  request: vi.fn<(config: AxiosRequestConfig) => Promise<{ data: unknown; headers: Record<string, unknown> }>>(),
}));

vi.mock('axios', () => ({
  default: Object.assign(axiosMocks.request, {
    isAxiosError: axiosMocks.isAxiosError,
  }),
}));

const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => logger);
let refreshTokenSpy: MockInstance<ApiTokenService['refreshToken']>;

const getLoggedMessages = (): string[] => loggerError.mock.calls.flatMap(([message]) => (typeof message === 'string' ? [message] : []));

describe('ApiService security boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMocks.isAxiosError.mockReturnValue(false);
    vi.spyOn(ApiTokenService.prototype, 'getToken').mockResolvedValue('top-secret-bearer-token');
    refreshTokenSpy = vi.spyOn(ApiTokenService.prototype, 'refreshToken').mockResolvedValue('refreshed-integration-test-token');
  });

  it('logs request metadata without credentials or payload data', async () => {
    const response = {
      status: 400,
      data: { detail: 'upstream personal data' },
      config: {
        baseURL: 'https://api.example.test',
        url: '/errands',
        method: 'post',
        data: JSON.stringify({ personId: 'secret-person-id' }),
        headers: {
          Authorization: 'Bearer top-secret-bearer-token',
          get: (headerName: string) => (headerName === 'X-Request-Id' ? 'request-id-123' : undefined),
        },
      },
    };

    axiosMocks.request.mockRejectedValueOnce({ response });
    axiosMocks.isAxiosError.mockReturnValue(true);

    await expect(new ApiService().post({ baseURL: 'https://api.example.test', url: '/errands' }, citizenSender)).rejects.toMatchObject({
      status: 500,
    } satisfies Partial<HttpException>);

    const loggedMessages = getLoggedMessages();
    expect(loggedMessages.some(message => message.includes('status=400'))).toBe(true);
    expect(loggedMessages.some(message => message.includes('requestId=request-id-123'))).toBe(true);
    expect(loggedMessages.some(message => message.includes('api.example.test'))).toBe(false);
    expect(loggedMessages.some(message => message.includes('top-secret-bearer-token'))).toBe(false);
    expect(loggedMessages.some(message => message.includes('secret-person-id'))).toBe(false);
    expect(loggedMessages.some(message => message.includes('upstream personal data'))).toBe(false);
    expect(loggedMessages.every(message => !/[\r\n]/.test(message))).toBe(true);
  });

  it('does not forward the bearer token to a cross-origin Location response', async () => {
    axiosMocks.request.mockResolvedValueOnce({
      data: undefined,
      headers: { location: 'https://attacker.example/errands/123' },
    });

    await expect(new ApiService().post({ baseURL: 'https://api.example.test', url: '/errands' }, citizenSender)).rejects.toMatchObject({
      status: 502,
    });

    expect(axiosMocks.request).toHaveBeenCalledTimes(1);
  });

  it('resolves same-origin Location responses with the request timeout', async () => {
    axiosMocks.request.mockResolvedValueOnce({
      data: undefined,
      headers: { location: '/errands/123' },
    });
    axiosMocks.request.mockResolvedValueOnce({ data: { id: '123' }, headers: {} });

    await expect(new ApiService().post({ baseURL: 'https://api.example.test', url: '/errands' }, citizenSender)).resolves.toEqual({
      data: { id: '123' },
      message: 'success',
    });

    const [redirectConfig] = axiosMocks.request.mock.calls[1] ?? [];
    expect(redirectConfig).toMatchObject({
      headers: { Authorization: 'Bearer top-secret-bearer-token' },
      maxRedirects: 0,
      method: 'GET',
      timeout: 30_000,
      url: 'https://api.example.test/errands/123',
    });
  });

  it('sets a timeout on ordinary upstream requests', async () => {
    axiosMocks.request.mockResolvedValueOnce({ data: { ok: true }, headers: {} });

    await new ApiService().get({ baseURL: 'https://api.example.test', url: '/health' }, citizenSender);

    const [requestConfig] = axiosMocks.request.mock.calls[0] ?? [];
    expect(requestConfig).toMatchObject({
      baseURL: undefined,
      maxRedirects: 0,
      timeout: 30_000,
      url: 'https://api.example.test/health',
    });
  });

  // X-Sent-By is the audit trail upstream keeps. A request that cannot name its citizen must fail
  // here rather than reach upstream under a placeholder identity.
  it('refuses to call upstream when the request carries no party id', async () => {
    await expect(new ApiService().get({ baseURL: 'https://api.example.test', url: '/health' }, { session: {} })).rejects.toMatchObject({
      status: 500,
    } satisfies Partial<HttpException>);

    expect(axiosMocks.request).not.toHaveBeenCalled();
  });

  it('names the no-session callers explicitly rather than defaulting to a placeholder', async () => {
    axiosMocks.request.mockResolvedValueOnce({ data: { ok: true }, headers: {} });

    await new ApiService().get({ baseURL: 'https://api.example.test', url: '/health' }, NO_SESSION_SENDER);

    const [requestConfig] = axiosMocks.request.mock.calls[0] ?? [];
    expect(requestConfig?.headers).toMatchObject({ 'X-Sent-By': 'type=partyId; no-session' });
  });

  it('does not allow callers to disable the gateway timeout', async () => {
    axiosMocks.request.mockResolvedValueOnce({ data: { ok: true }, headers: {} });

    await new ApiService().get({ baseURL: 'https://api.example.test', url: '/health', timeout: 0 }, citizenSender);

    const [requestConfig] = axiosMocks.request.mock.calls[0] ?? [];
    expect(requestConfig?.timeout).toBe(30_000);
  });

  it('does not allow a caller to override gateway-owned security headers', async () => {
    axiosMocks.request.mockResolvedValueOnce({ data: { ok: true }, headers: {} });

    await new ApiService().post(
      {
        baseURL: 'https://api.example.test',
        url: '/errands',
        headers: {
          Authorization: 'Bearer caller-controlled-token',
          'X-Request-Id': 'caller-controlled-request-id',
          'X-Sent-By': 'caller-controlled-user',
        },
      },
      citizenSender,
    );

    const [requestConfig] = axiosMocks.request.mock.calls[0] ?? [];
    expect(requestConfig?.headers).toMatchObject({
      Authorization: 'Bearer top-secret-bearer-token',
      'X-Sent-By': `type=partyId; ${mockCitizenPartyId}`,
    });
    expect(requestConfig?.headers?.['X-Request-Id']).not.toBe('caller-controlled-request-id');
  });

  it('normalizes lowercase caller headers before applying gateway-owned values', async () => {
    axiosMocks.request.mockResolvedValueOnce({ data: { ok: true }, headers: {} });

    await new ApiService().post(
      {
        baseURL: 'https://api.example.test',
        url: '/errands',
        headers: { authorization: 'Bearer lowercase-caller-token' },
      },
      citizenSender,
    );

    const [requestConfig] = axiosMocks.request.mock.calls[0] ?? [];
    expect(requestConfig?.headers).toMatchObject({ Authorization: 'Bearer top-secret-bearer-token' });
  });

  it('converts status-shaped non-Axios rejections to the generic gateway error', async () => {
    axiosMocks.request.mockRejectedValueOnce({ status: 418, message: 'Caller-controlled rejection' });

    await expect(new ApiService().get({ baseURL: 'https://api.example.test', url: '/health' }, citizenSender)).rejects.toMatchObject({
      status: 500,
      message: 'Internal server error from gateway',
    });
  });

  it('preserves an opted-in upstream client status without exposing its response message', async () => {
    const response = {
      status: 409,
      data: { detail: 'Sensitive upstream conflict details' },
      config: {
        method: 'patch',
        headers: {
          get: (headerName: string) => (headerName === 'X-Request-Id' ? 'request-id-409' : undefined),
        },
      },
    };

    axiosMocks.request.mockRejectedValueOnce({ response });
    axiosMocks.isAxiosError.mockReturnValue(true);

    await expect(
      new ApiService().patch(
        {
          baseURL: 'https://api.example.test',
          url: '/errands/123',
          propagateClientError: true,
        },
        citizenSender,
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Upstream request rejected',
    });

    const [requestConfig] = axiosMocks.request.mock.calls[0] ?? [];
    expect(requestConfig).not.toHaveProperty('propagateClientError');
    expect(getLoggedMessages().some(message => message.includes('Sensitive upstream conflict details'))).toBe(false);
  });

  it('keeps upstream client errors generic unless propagation is explicitly enabled', async () => {
    const response = {
      status: 409,
      data: { detail: 'Conflict' },
      config: {
        method: 'patch',
        headers: { get: () => 'request-id-default' },
      },
    };

    axiosMocks.request.mockRejectedValueOnce({ response });
    axiosMocks.isAxiosError.mockReturnValue(true);

    await expect(new ApiService().patch({ baseURL: 'https://api.example.test', url: '/errands/123' }, citizenSender)).rejects.toMatchObject({
      status: 500,
      message: 'Internal server error from gateway',
    });
  });

  it('never propagates an upstream 401 even when client-error propagation is enabled', async () => {
    const response = {
      status: 401,
      data: { detail: 'Upstream authentication details' },
      config: {
        method: 'patch',
        headers: { get: () => 'request-id-401' },
      },
    };

    axiosMocks.request.mockRejectedValueOnce({ response }).mockRejectedValueOnce({ response });
    axiosMocks.isAxiosError.mockReturnValue(true);

    await expect(
      new ApiService().patch(
        {
          baseURL: 'https://api.example.test/supportmanagement/14.14',
          url: '/errands/123',
          propagateClientError: true,
        },
        citizenSender,
      ),
    ).rejects.toMatchObject({
      status: 500,
      message: 'Internal server error from gateway',
    });

    expect(getLoggedMessages().some(message => message.includes('Upstream authentication details'))).toBe(false);
    expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
    expect(axiosMocks.request).toHaveBeenCalledTimes(2);
  });
});
