import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from '@config';
import { createClient } from 'redis';

import { logger } from './logger';

export type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;

/** Shared client, or null when REDIS_HOST is unset (local development). */
export async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient) return redisClient;
  if (REDIS_HOST === undefined || REDIS_HOST === '') return null;

  const port = Number(REDIS_PORT !== undefined && REDIS_PORT !== '' ? REDIS_PORT : 6379);
  const client = createClient({
    socket: {
      host: REDIS_HOST,
      port,
      reconnectStrategy: retries => Math.min(retries * 100, 3000),
    },
    password: REDIS_PASSWORD !== undefined && REDIS_PASSWORD !== '' ? REDIS_PASSWORD : undefined,
  });

  client.on('error', (err: Error) => {
    logger.error(`Redis error: ${err.message}`);
  });
  client.on('connect', () => {
    logger.info(`Connected to Redis (${REDIS_HOST}:${String(port)})`);
  });
  client.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  await client.connect();
  redisClient = client;
  return client;
}
