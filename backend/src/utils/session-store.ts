import { SESSION_MEMORY } from '@config';
import { RedisStore } from 'connect-redis';
import session from 'express-session';
import { existsSync, mkdirSync } from 'fs';
import createMemoryStore from 'memorystore';
import createFileStore from 'session-file-store';

import { logger } from './logger';
import { getRedisClient } from './redis';

export const SESSION_TTL = 2 * 60 * 60;

const FILE_STORE_PATH = './data/sessions';

/** Store without external dependencies: memory with SESSION_MEMORY=true, otherwise files. */
export function createLocalSessionStore(): session.Store {
  if (SESSION_MEMORY) {
    // memorystore takes ms, the file store seconds
    return new (createMemoryStore(session))({ checkPeriod: SESSION_TTL * 1000 });
  }
  if (!existsSync(FILE_STORE_PATH)) {
    mkdirSync(FILE_STORE_PATH, { recursive: true });
  }
  return new (createFileStore(session))({ ttl: SESSION_TTL, path: FILE_STORE_PATH });
}

/**
 * Redis when REDIS_HOST is set, so sessions survive restarts and are shared between pods.
 * A configured but unreachable Redis is fatal rather than a silent fallback to local sessions.
 */
export async function createSessionStore(): Promise<session.Store> {
  const redisClient = await getRedisClient();
  if (redisClient) {
    logger.info('Using Redis session store');
    return new RedisStore({ client: redisClient, prefix: 'sess:', ttl: SESSION_TTL });
  }

  logger.info(`Using ${SESSION_MEMORY ? 'memory' : 'file'} session store (no REDIS_HOST)`);
  return createLocalSessionStore();
}
