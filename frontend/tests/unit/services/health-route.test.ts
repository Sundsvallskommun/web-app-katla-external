import axios from 'axios';
import { headers } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../../../src/app/api/health/up/route';

vi.mock('axios');
vi.mock('next/headers');

const mockedAxios = vi.mocked(axios);
const mockedHeaders = vi.mocked(headers);

const setAuthorizationHeader = (authorization: string | null) => {
  const requestHeaders = new Headers();
  if (authorization !== null) {
    requestHeaders.set('authorization', authorization);
  }
  mockedHeaders.mockResolvedValue(requestHeaders);
};

describe('GET /api/health/up', () => {
  beforeEach(() => {
    vi.stubEnv('HEALTH_AUTH', 'false');
    vi.stubEnv('INTERNAL_API_URL', 'http://backend:3000/api');
    vi.stubEnv('HEALTH_REQUEST_TIMEOUT_MS', '2500');
    setAuthorizationHeader(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('uses the internal backend URL and a bounded request timeout', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'UP' } });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockedAxios.get.mock.calls).toEqual([['http://backend:3000/api/health/up', { timeout: 2_500 }]]);
    await expect(response.json()).resolves.toEqual({ status: 'UP' });
  });

  it('falls back to NEXT_PUBLIC_API_URL when INTERNAL_API_URL is empty', async () => {
    vi.stubEnv('INTERNAL_API_URL', '');
    mockedAxios.get.mockResolvedValue({ data: { status: 'UP' } });

    await GET();

    expect(mockedAxios.get.mock.calls).toEqual([['http://localhost:3001/api/health/up', { timeout: 2_500 }]]);
  });

  it('does not accept empty credentials when authentication is enabled', async () => {
    vi.stubEnv('HEALTH_AUTH', 'true');
    vi.stubEnv('HEALTH_USERNAME', '');
    vi.stubEnv('HEALTH_PASSWORD', '');
    setAuthorizationHeader('Basic Og==');

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ status: 'MISCONFIGURED' });
    expect(mockedAxios.get.mock.calls).toHaveLength(0);
  });

  it('rejects incorrect credentials before contacting the backend', async () => {
    vi.stubEnv('HEALTH_AUTH', 'true');
    vi.stubEnv('HEALTH_USERNAME', 'health-user');
    vi.stubEnv('HEALTH_PASSWORD', 'secret');
    setAuthorizationHeader('Basic Og==');

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockedAxios.get.mock.calls).toHaveLength(0);
  });

  it('accepts the configured credentials', async () => {
    vi.stubEnv('HEALTH_AUTH', 'true');
    vi.stubEnv('HEALTH_USERNAME', 'health-user');
    vi.stubEnv('HEALTH_PASSWORD', 'secret');
    setAuthorizationHeader(`Basic ${Buffer.from('health-user:secret').toString('base64')}`);
    mockedAxios.get.mockResolvedValue({ data: { status: 'UP' } });

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('returns service unavailable without exposing upstream error details', async () => {
    mockedAxios.get.mockRejectedValue(new Error('secret upstream details'));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: 'UNAVAILABLE' });
  });
});
