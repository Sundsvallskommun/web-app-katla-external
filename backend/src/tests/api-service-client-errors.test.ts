import axios from 'axios';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import ApiService from '@/services/api.service';
import ApiTokenService from '@/services/api-token.service';

import { mockCitizenPartyId } from './helpers/mock-data';

vi.mock('axios');

const mockedAxios = vi.mocked(axios);
const citizenSender = { user: { partyId: mockCitizenPartyId } };
let refreshTokenSpy: MockInstance<ApiTokenService['refreshToken']>;

describe('ApiService client-error propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ApiTokenService.prototype, 'getToken').mockResolvedValue('test-token');
    refreshTokenSpy = vi.spyOn(ApiTokenService.prototype, 'refreshToken').mockResolvedValue('refreshed-token');
  });

  it('treats an upstream 204 response with no body as a successful request', async () => {
    mockedAxios.mockResolvedValueOnce({
      data: undefined,
      status: 204,
      statusText: 'No Content',
      headers: {},
      config: { headers: {} },
    });

    await expect(
      new ApiService().patch<undefined>(
        {
          baseURL: 'https://api.example.test',
          url: '/errands/errand-id',
        },
        citizenSender,
      ),
    ).resolves.toEqual({ data: undefined, message: 'success' });
  });

  it('preserves an opted-in upstream conflict status with a safe message', async () => {
    const response = {
      status: 409,
      data: { detail: 'Sensitive upstream conflict details' },
      config: {
        method: 'patch',
        headers: { get: () => 'request-id-409' },
      },
    };
    mockedAxios.mockRejectedValueOnce({ response });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(
      new ApiService().patch(
        {
          baseURL: 'https://api.example.test',
          url: '/errands/123',
          propagateClientError: true,
        },
        citizenSender,
      ),
    ).rejects.toMatchObject({ status: 409, message: 'Upstream request rejected' });

    const requestConfig: unknown = mockedAxios.mock.calls[0]?.[0];
    if (!requestConfig || typeof requestConfig !== 'object') throw new Error('Expected an Axios request config');
    expect('propagateClientError' in requestConfig).toBe(false);
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
    mockedAxios.mockRejectedValueOnce({ response });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(new ApiService().patch({ baseURL: 'https://api.example.test', url: '/errands/123' }, citizenSender)).rejects.toMatchObject({
      status: 500,
      message: 'Internal server error from gateway',
    });
  });

  it('refreshes the OAuth token and retries an upstream authentication challenge once', async () => {
    const firstResponse = {
      status: 401,
      data: { detail: 'Gateway credential rejected' },
      config: {
        method: 'patch',
        headers: { get: () => 'request-id-first-401' },
      },
    };
    mockedAxios.mockRejectedValueOnce({ response: firstResponse }).mockResolvedValueOnce({
      data: { id: '123' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(
      new ApiService().patch(
        {
          baseURL: 'https://api.example.test',
          url: '/errands/123',
          propagateClientError: true,
        },
        citizenSender,
      ),
    ).resolves.toEqual({ data: { id: '123' }, message: 'success' });

    expect(refreshTokenSpy).toHaveBeenCalledWith('test-token');
    expect(mockedAxios).toHaveBeenCalledTimes(2);
    expect(mockedAxios.mock.calls[1]?.[0]).toMatchObject({
      headers: { Authorization: 'Bearer refreshed-token' },
      method: 'PATCH',
    });
  });

  it('keeps a second upstream authentication challenge generic', async () => {
    const firstResponse = {
      status: 401,
      data: { detail: 'First gateway credential rejection' },
      config: {
        method: 'get',
        headers: { get: () => 'request-id-first-401' },
      },
    };
    const secondResponse = {
      status: 401,
      data: { detail: 'Second gateway credential rejection' },
      config: {
        method: 'get',
        headers: { get: () => 'request-id-second-401' },
      },
    };
    mockedAxios.mockRejectedValueOnce({ response: firstResponse }).mockRejectedValueOnce({ response: secondResponse });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(new ApiService().get({ baseURL: 'https://api.example.test', url: '/errands' }, citizenSender)).rejects.toMatchObject({
      status: 500,
      message: 'Internal server error from gateway',
    });

    expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
    expect(mockedAxios).toHaveBeenCalledTimes(2);
  });

  it('retries only the Location follow-up when it receives a 401 after a successful POST', async () => {
    const redirectResponse = {
      status: 401,
      data: { detail: 'Gateway credential rejected on Location follow-up' },
      config: {
        method: 'get',
        headers: { get: () => 'request-id-redirect-401' },
      },
    };
    mockedAxios
      .mockResolvedValueOnce({ data: undefined, headers: { location: '/errands/123' } })
      .mockRejectedValueOnce({ response: redirectResponse })
      .mockResolvedValueOnce({ data: { id: '123' }, headers: {} });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(new ApiService().post({ baseURL: 'https://api.example.test/gateway', url: '/errands' }, citizenSender)).resolves.toEqual({
      data: { id: '123' },
      message: 'success',
    });

    expect(mockedAxios.mock.calls[0]?.[0]).toMatchObject({ method: 'POST' });
    expect(mockedAxios.mock.calls[1]?.[0]).toMatchObject({ method: 'GET' });
    expect(mockedAxios.mock.calls[2]?.[0]).toMatchObject({ method: 'GET' });
    expect(refreshTokenSpy).toHaveBeenCalledWith('test-token');
  });
});
