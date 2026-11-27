import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HealthController } from '@/controllers/health.controller';
import { HttpException } from '@/exceptions/HttpException';
import { isRedisReady } from '@/utils/redis';

const post = vi.fn();

vi.mock('@/utils/redis', () => ({ isRedisReady: vi.fn() }));
vi.mock('@/services/api.service', () => ({
  NO_SESSION_SENDER: Symbol('no-session'),
  default: class {
    post = post;
  },
}));

const mockedIsRedisReady = vi.mocked(isRedisReady);

describe('HealthController /health/up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: { status: 'OK' } });
  });

  it('checks the downstream API when Redis is ready', async () => {
    mockedIsRedisReady.mockReturnValue(true);

    await expect(new HealthController().up()).resolves.toEqual({ status: 'OK' });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('fails with 503 without calling downstream when Redis is not ready', async () => {
    mockedIsRedisReady.mockReturnValue(false);

    const result = new HealthController().up();

    await expect(result).rejects.toBeInstanceOf(HttpException);
    await expect(result).rejects.toMatchObject({ status: 503 });
    expect(post).not.toHaveBeenCalled();
  });
});
