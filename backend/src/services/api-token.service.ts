import { CLIENT_KEY, CLIENT_SECRET } from '@config';
import { API_BASE_URL } from '@config';
import { logger } from '@utils/logger';
import { getRedisClient, RedisClient } from '@utils/redis';
import axios from 'axios';
import qs from 'qs';

import { HttpException } from '@/exceptions/HttpException';

export interface Token {
  access_token: string;
  expires_in: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

// Shared between pods via Redis when REDIS_HOST is set; the process cache sits in front of it.
const REDIS_TOKEN_KEY = 'wso2:token';
const REDIS_LOCK_KEY = 'wso2:token_lock';
const LOCK_TTL_SECONDS = 10;
const LOCK_WAIT_MS = 500;
const LOCK_MAX_RETRIES = 5;
const EXPIRY_MARGIN_MS = 10_000;

let c_token: CachedToken | undefined;
let c_token_request: Promise<string> | undefined;

const isValid = (cached: CachedToken | undefined, rejectedToken?: string): cached is CachedToken =>
  cached !== undefined && cached.token !== '' && cached.token !== rejectedToken && Date.now() < cached.expiresAt;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const readShared = async (redis: RedisClient): Promise<CachedToken | undefined> => {
  const raw = await redis.get(REDIS_TOKEN_KEY);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as CachedToken;
  } catch {
    return undefined;
  }
};

class ApiTokenService {
  public async getToken(): Promise<string> {
    if (isValid(c_token)) return c_token.token;

    const redis = await getRedisClient();
    const shared = redis ? await readShared(redis) : undefined;
    if (isValid(shared)) {
      c_token = shared;
      return shared.token;
    }

    return await this.fetchToken();
  }

  /**
   * Replace only the token that was actually rejected. If another call or pod has already
   * refreshed the shared cache, reuse the newer token.
   */
  public async refreshToken(rejectedToken: string): Promise<string> {
    if (isValid(c_token, rejectedToken)) return c_token.token;

    const redis = await getRedisClient();
    const shared = redis ? await readShared(redis) : undefined;
    if (isValid(shared, rejectedToken)) {
      c_token = shared;
      return shared.token;
    }

    return await this.fetchToken(rejectedToken);
  }

  public setToken(token: Token): CachedToken {
    c_token = { token: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 - EXPIRY_MARGIN_MS };

    logger.info(`Token valid for: ${token.expires_in}`);
    logger.info(`Token expires at: ${String(new Date(c_token.expiresAt))}`);
    return c_token;
  }

  /** One request per process at a time; with Redis also one per cluster, guarded by a lock. */
  public async fetchToken(rejectedToken?: string): Promise<string> {
    if (c_token_request) {
      return await c_token_request;
    }

    const tokenRequest = getRedisClient().then(async redis =>
      redis ? await this.fetchTokenShared(redis, rejectedToken) : (await this.requestToken()).token,
    );
    c_token_request = tokenRequest;

    try {
      return await tokenRequest;
    } finally {
      if (c_token_request === tokenRequest) {
        c_token_request = undefined;
      }
    }
  }

  private async fetchTokenShared(redis: RedisClient, rejectedToken: string | undefined): Promise<string> {
    const acquired = await redis.set(REDIS_LOCK_KEY, '1', { condition: 'NX', expiration: { type: 'EX', value: LOCK_TTL_SECONDS } });

    if (acquired === null) {
      // Another pod is fetching: wait for its token
      for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
        await sleep(LOCK_WAIT_MS);
        const shared = await readShared(redis);
        if (isValid(shared, rejectedToken)) {
          c_token = shared;
          return shared.token;
        }
      }
      logger.warn('Token lock wait timed out, fetching token directly');
    }

    try {
      const cached = await this.requestToken();
      const ttlSeconds = Math.max(1, Math.floor((cached.expiresAt - Date.now()) / 1000));
      await redis.set(REDIS_TOKEN_KEY, JSON.stringify(cached), { expiration: { type: 'EX', value: ttlSeconds } });
      return cached.token;
    } finally {
      if (acquired !== null) {
        await redis.del(REDIS_LOCK_KEY).catch(() => undefined);
      }
    }
  }

  private async requestToken(): Promise<CachedToken> {
    logger.info('Getting oauth API token');
    const authString = Buffer.from(`${CLIENT_KEY}:${CLIENT_SECRET}`, 'utf-8').toString('base64');

    try {
      const { data: token } = await axios<Token>({
        maxRedirects: 0,
        timeout: 30000, // NOTE: milliseconds
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + authString,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: qs.stringify({
          grant_type: 'client_credentials',
        }),
        url: `${API_BASE_URL}/token`,
      });

      if (!token) throw new HttpException(502, 'Bad Gateway');
      return this.setToken(token);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      logger.error(`Failed to fetch OAuth access token${status ? ` (status ${status})` : ''}`);
      throw new HttpException(502, 'Bad Gateway');
    }
  }
}

export default ApiTokenService;
