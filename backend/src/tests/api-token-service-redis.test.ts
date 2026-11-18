import { beforeEach, describe, expect, it, vi } from 'vitest';

interface SetOptions {
  condition?: 'NX';
  expiration?: { type: 'EX'; value: number };
}

const fakeRedis = vi.hoisted(() => {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string, options?: SetOptions) => {
      if (options?.condition === 'NX' && store.has(key)) return Promise.resolve(null);
      store.set(key, value);
      if (options?.expiration) ttls.set(key, options.expiration.value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => Promise.resolve(store.delete(key) ? 1 : 0)),
  };
});

const axiosRequest = vi.hoisted(() => vi.fn<(config: unknown) => Promise<unknown>>());

vi.mock('@/utils/redis', () => ({ getRedisClient: () => Promise.resolve(fakeRedis) }));
vi.mock('axios', () => ({ default: Object.assign(axiosRequest, { isAxiosError: () => false }) }));

const TOKEN_KEY = 'wso2:token';
const LOCK_KEY = 'wso2:token_lock';

const sharedToken = (token: string, expiresInMs = 60_000) => JSON.stringify({ token, expiresAt: Date.now() + expiresInMs });

// Fresh module per test: the process cache is module state.
const loadService = async () => {
  vi.resetModules();
  const { default: ApiTokenService } = await import('@/services/api-token.service');
  return new ApiTokenService();
};

describe('ApiTokenService with Redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeRedis.store.clear();
    fakeRedis.ttls.clear();
  });

  it('uses the token another pod stored instead of calling WSO2', async () => {
    fakeRedis.store.set(TOKEN_KEY, sharedToken('pod-a-token'));
    const service = await loadService();

    await expect(service.getToken()).resolves.toBe('pod-a-token');
    expect(axiosRequest).not.toHaveBeenCalled();
  });

  it('fetches on a miss, stores the token with a TTL and releases the lock', async () => {
    axiosRequest.mockResolvedValueOnce({ data: { access_token: 'new-token', expires_in: 3600 } });
    const service = await loadService();

    await expect(service.getToken()).resolves.toBe('new-token');
    expect(axiosRequest).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fakeRedis.store.get(TOKEN_KEY) ?? '{}')).toMatchObject({ token: 'new-token' });
    expect(fakeRedis.ttls.get(TOKEN_KEY)).toBeGreaterThan(3500);
    expect(fakeRedis.store.has(LOCK_KEY)).toBe(false);
  });

  it('waits for the pod holding the lock and uses its token', async () => {
    fakeRedis.store.set(LOCK_KEY, '1');
    const service = await loadService();

    const token = service.getToken();
    fakeRedis.store.set(TOKEN_KEY, sharedToken('pod-a-token'));

    await expect(token).resolves.toBe('pod-a-token');
    expect(axiosRequest).not.toHaveBeenCalled();
  });

  it('replaces a rejected shared token', async () => {
    fakeRedis.store.set(TOKEN_KEY, sharedToken('rejected-token'));
    axiosRequest.mockResolvedValueOnce({ data: { access_token: 'fresh-token', expires_in: 3600 } });
    const service = await loadService();

    await expect(service.getToken()).resolves.toBe('rejected-token');
    await expect(service.refreshToken('rejected-token')).resolves.toBe('fresh-token');
    expect(JSON.parse(fakeRedis.store.get(TOKEN_KEY) ?? '{}')).toMatchObject({ token: 'fresh-token' });
  });

  it('reuses a token another pod already refreshed', async () => {
    fakeRedis.store.set(TOKEN_KEY, sharedToken('rejected-token'));
    const service = await loadService();
    await service.getToken();

    fakeRedis.store.set(TOKEN_KEY, sharedToken('pod-a-fresh-token'));

    await expect(service.refreshToken('rejected-token')).resolves.toBe('pod-a-fresh-token');
    expect(axiosRequest).not.toHaveBeenCalled();
  });
});
