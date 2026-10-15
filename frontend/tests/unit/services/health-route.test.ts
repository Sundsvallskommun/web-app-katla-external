import axios from 'axios';
import { headers } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../../../src/app/api/health/up/route';

vi.mock('axios');
vi.mock('next/headers');

const mockedAxios = vi.mocked(axios);
const mockedHeaders = vi.mocked(headers);

describe('health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHeaders.mockResolvedValue(new Headers());
  });

  it('keeps default TLS validation when requesting upstream health', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'UP' } });

    const response = await GET();

    expect(mockedAxios.get.mock.calls).toEqual([['http://localhost:3001/api/health/up']]);
    await expect(response.json()).resolves.toEqual({ status: 'UP' });
  });

  it('uses API_URL_INTERNAL for the upstream call when set', async () => {
    vi.stubEnv('API_URL_INTERNAL', 'http://localhost:3001/api');
    vi.resetModules();
    const { GET: get } = await import('../../../src/app/api/health/up/route');
    mockedAxios.get.mockResolvedValue({ data: { status: 'UP' } });

    await get();

    expect(mockedAxios.get.mock.calls).toEqual([['http://localhost:3001/api/health/up']]);
    vi.unstubAllEnvs();
  });

  it('does not expose upstream error details', async () => {
    mockedAxios.get.mockRejectedValue(new Error('secret upstream details'));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Upstream health check failed',
      status: 'ERROR!',
    });
  });
});
