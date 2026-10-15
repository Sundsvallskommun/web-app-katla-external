import { CLIENT_KEY, CLIENT_SECRET } from '@config';
import { API_BASE_URL } from '@config';
import { logger } from '@utils/logger';
import axios from 'axios';
import qs from 'qs';

import { HttpException } from '@/exceptions/HttpException';

export interface Token {
  access_token: string;
  expires_in: number;
}

// NOTE: save token in memory only for now
let c_access_token = '';
let c_token_expires = 0;
let c_token_request: Promise<string> | undefined;

class ApiTokenService {
  public async getToken(): Promise<string> {
    if (c_access_token === '' || Date.now() >= c_token_expires) {
      return await this.fetchToken();
    }
    return c_access_token;
  }

  /**
   * Replace only the token that was actually rejected. If another call has already refreshed
   * the shared cache, reuse the newer token.
   */
  public async refreshToken(rejectedToken: string): Promise<string> {
    if (c_access_token !== '' && c_access_token !== rejectedToken && Date.now() < c_token_expires) {
      return c_access_token;
    }

    if (c_access_token === rejectedToken) {
      c_access_token = '';
      c_token_expires = 0;
    }

    return await this.getToken();
  }

  public setToken(token: Token): void {
    c_access_token = token.access_token;
    // NOTE: Set timestamp for when we need to refresh minus 10 seconds for margin
    c_token_expires = Date.now() + (token.expires_in * 1000 - 10000);

    logger.info(`Token valid for: ${token.expires_in}`);
    logger.info(`Current time: ${String(new Date())}`);
    logger.info(`Token expires at: ${String(new Date(c_token_expires))}`);
  }

  private async requestToken(): Promise<string> {
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
      this.setToken(token);

      return c_access_token;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      logger.error(`Failed to fetch OAuth access token${status ? ` (status ${status})` : ''}`);
      throw new HttpException(502, 'Bad Gateway');
    }
  }

  public async fetchToken(): Promise<string> {
    if (c_token_request) {
      return await c_token_request;
    }

    logger.info('Getting oauth API token');
    const tokenRequest = this.requestToken();
    c_token_request = tokenRequest;

    try {
      return await tokenRequest;
    } finally {
      if (c_token_request === tokenRequest) {
        c_token_request = undefined;
      }
    }
  }
}

export default ApiTokenService;
