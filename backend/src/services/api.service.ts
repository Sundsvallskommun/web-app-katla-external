import axios, { AxiosRequestConfig, AxiosResponse, RawAxiosRequestHeaders } from 'axios';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { ENVIRONMENT } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import ApiResponse from '@/interfaces/api-service.interface';
import { RequestWithUser } from '@/interfaces/auth.interface';
import { User } from '@/interfaces/users.interface';
import { logger } from '@/utils/logger';
import { apiURL } from '@/utils/util';

import ApiTokenService from './api-token.service';

export interface ApiRequestConfig extends AxiosRequestConfig {
  /** Keep an upstream 4xx status without exposing its untrusted response body. */
  propagateClientError?: boolean;
  /** Leave a Location header unfollowed, for a created resource the caller does not want back. The bounded Location is returned instead. */
  skipLocationFollow?: boolean;
}

/**
 * Everything ApiService needs from its caller: who to attribute the upstream request to. Narrow
 * enough that the SAML callback, which has no request yet, can name a sender too.
 */
export interface ApiRequest extends Omit<Partial<RequestWithUser>, 'session' | 'user'> {
  user?: Pick<User, 'partyId'>;
  session?: Omit<Partial<Request['session']>, 'user'> & { user?: Pick<User, 'partyId'> };
}

/**
 * The only calls that legitimately have no citizen behind them: the liveness probe, and the
 * Citizen exchange during SAML login that resolves the party id in the first place. Anything else
 * must pass a request whose user carries a party id.
 */
export const NO_SESSION_SENDER = Symbol('no session sender');

export type Sender = ApiRequest | typeof NO_SESSION_SENDER;

const SENT_BY_NO_SESSION = 'type=partyId; no-session';

const buildSentBy = (sender: Sender): string => {
  if (sender === NO_SESSION_SENDER) return SENT_BY_NO_SESSION;

  const partyId = sender.user?.partyId;
  if (partyId === undefined || partyId === '') {
    // Fail loudly: a session-backed call that cannot name its citizen would otherwise reach
    // upstream anonymously, and the audit trail there would be wrong rather than missing.
    logger.error('Refusing to call upstream: the request has no party id to send as X-Sent-By');
    throw new HttpException(500, 'No party id to identify the caller upstream');
  }

  return `type=partyId; ${partyId}`;
};

const API_REQUEST_TIMEOUT_MS = 30_000;
const ABSOLUTE_URL_PATTERN = /^([a-z][a-z\d+.-]*:)?\/\//i;

interface ResolvedRequestUrl {
  requestUrl: URL;
  boundaryUrl: URL;
}

interface AuthenticatedResponse<T> {
  response: AxiosResponse<T>;
  token: string;
}

type AuthenticatedRequestConfig = Omit<AxiosRequestConfig, 'headers'> & {
  headers: RawAxiosRequestHeaders;
};

const asDirectoryUrl = (url: URL): URL => {
  const directoryUrl = new URL(url.toString());
  directoryUrl.pathname = `${directoryUrl.pathname.replace(/\/+$/, '')}/`;
  directoryUrl.search = '';
  directoryUrl.hash = '';
  return directoryUrl;
};

const isWithinUrlBoundary = (candidate: URL, boundary: URL): boolean =>
  candidate.origin === boundary.origin && candidate.pathname.startsWith(asDirectoryUrl(boundary).pathname);

const assertDecodedPathWithinBoundary = (candidateUrl: URL, boundaryUrl: URL): void => {
  let decodedPath = candidateUrl.pathname;

  // Express and upstream gateways may decode a path segment at different layers. Check every
  // effective representation so encoded separators cannot hide an otherwise obvious dot-segment
  // escape from the configured service base.
  for (let decodingPass = 0; decodingPass < 3; decodingPass += 1) {
    let nextDecodedPath: string;
    try {
      nextDecodedPath = decodeURIComponent(decodedPath);
    } catch {
      throw new HttpException(500, 'Invalid upstream request URL');
    }

    if (nextDecodedPath === decodedPath) return;
    const decodedUrl = new URL(nextDecodedPath, candidateUrl.origin);
    if (!isWithinUrlBoundary(decodedUrl, boundaryUrl)) {
      throw new HttpException(500, 'Invalid upstream request URL');
    }
    decodedPath = nextDecodedPath;
  }

  // Deeply nested encodings are ambiguous between infrastructure layers and have no valid use
  // in the gateway-owned API paths.
  let furtherDecodedPath: string;
  try {
    furtherDecodedPath = decodeURIComponent(decodedPath);
  } catch {
    throw new HttpException(500, 'Invalid upstream request URL');
  }
  if (furtherDecodedPath !== decodedPath) {
    throw new HttpException(500, 'Invalid upstream request URL');
  }
};

const resolveRequestUrl = (config: Pick<AxiosRequestConfig, 'baseURL' | 'url'>): ResolvedRequestUrl => {
  const requestPath = config.url ?? '';

  if (ABSOLUTE_URL_PATTERN.test(requestPath)) {
    throw new HttpException(500, 'Invalid upstream request URL');
  }

  const boundaryUrl = new URL(config.baseURL ?? apiURL(''));
  const requestUrl = new URL(requestPath.replace(/^\/+/, ''), asDirectoryUrl(boundaryUrl));
  assertDecodedPathWithinBoundary(requestUrl, boundaryUrl);

  // WHATWG URL resolution normalises dot segments, so check the effective URL afterwards: a
  // relative `../` path must not escape the service base.
  if (!isWithinUrlBoundary(requestUrl, boundaryUrl)) {
    throw new HttpException(500, 'Invalid upstream request URL');
  }

  return { requestUrl, boundaryUrl };
};

/**
 * The upstream body carries the reason a request was rejected; without it the log only says that it
 * was. Local only: bodies and payloads hold personal data, which is also why the body is never
 * propagated to the client.
 */
const logUpstreamDetail = (response: AxiosResponse<unknown>): void => {
  if (ENVIRONMENT !== 'LOCAL') return;

  const asText = (value: unknown): string => {
    if (value === undefined || value === '') return '(empty)';
    if (typeof value === 'string') return value.slice(0, 2000);
    try {
      return JSON.stringify(value).slice(0, 2000);
    } catch {
      return '(unserialisable)';
    }
  };

  logger.error(`  upstream url: ${response.config.url ?? 'unknown'}`);
  logger.error(`  upstream body: ${asText(response.data)}`);
  logger.error(`  request payload: ${asText(response.config.data)}`);
};

const logAxiosErrorResponse = (response: AxiosResponse<unknown>): void => {
  const requestId = response.config.headers.get('X-Request-Id');
  const safeRequestId = typeof requestId === 'string' ? requestId : 'unknown';
  logger.error(`API request failed: status=${response.status}, method=${response.config.method ?? 'unknown'}, requestId=${safeRequestId}`);
  logUpstreamDetail(response);
};

const getBoundedLocation = (location: string, requestUrl: URL, boundaryUrl: URL): string => {
  // Upstream answers with a Location relative to its own service root, e.g.
  // `/{municipalityId}/{namespace}/errands/{id}`. Resolve it under the base path, not against
  // the origin: origin-relative resolution would land outside the service boundary and reject
  // every valid Location the gateway sends.
  const responseUrl = ABSOLUTE_URL_PATTERN.test(location)
    ? new URL(location, requestUrl)
    : new URL(location.replace(/^\/+/, ''), asDirectoryUrl(boundaryUrl));

  try {
    assertDecodedPathWithinBoundary(responseUrl, boundaryUrl);
  } catch (error) {
    if (error instanceof HttpException) {
      throw new HttpException(502, 'Invalid upstream redirect');
    }
    throw error;
  }

  if (!isWithinUrlBoundary(responseUrl, boundaryUrl)) {
    throw new HttpException(502, 'Invalid upstream redirect');
  }

  return responseUrl.toString();
};

class ApiService {
  private apiTokenService = new ApiTokenService();

  /**
   * A 401 from the API gateway means the process-cached OAuth token is no longer accepted.
   * Refresh the shared token and retry the same call exactly once; a second failure is the
   * caller's to handle.
   */
  private async executeAuthenticatedRequest<T>(config: AuthenticatedRequestConfig, token: string): Promise<AuthenticatedResponse<T>> {
    try {
      return { response: await axios<T>(config), token };
    } catch (error) {
      const response = axios.isAxiosError(error) ? error.response : undefined;
      if (response?.status !== 401) throw error;

      logAxiosErrorResponse(response);
      const refreshedToken = await this.apiTokenService.refreshToken(token);
      const retryRequestId = uuidv4();
      const retryConfig: AuthenticatedRequestConfig = {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${refreshedToken}`,
          'X-Request-Id': retryRequestId,
        },
      };

      if (process.env.NODE_ENV === 'development') {
        logger.info(`Retrying API request after OAuth refresh; x-request-id: ${retryRequestId}`);
      }

      return { response: await axios<T>(retryConfig), token: refreshedToken };
    }
  }

  private async request<T>(config: ApiRequestConfig, sender: Sender): Promise<ApiResponse<T>> {
    const { propagateClientError = false, skipLocationFollow = false, ...axiosConfig } = config;
    const { requestUrl, boundaryUrl } = resolveRequestUrl(axiosConfig);
    const token = await this.apiTokenService.getToken();

    const requestId = uuidv4();
    const defaultParams = {};

    // Callers always pass plain header objects; the type is widened so it can be spread safely.
    const configHeaders: RawAxiosRequestHeaders | undefined = axiosConfig.headers;

    const preparedConfig: AuthenticatedRequestConfig = {
      ...axiosConfig,
      headers: {
        'Content-Type': 'application/json',
        ...configHeaders,
        Authorization: `Bearer ${token}`,
        'X-Request-Id': requestId,
        // Citizens, not employees: upstream identifies the sender by party id, never an AD account.
        'X-Sent-By': buildSentBy(sender),
      },
      maxRedirects: 0,
      params: { ...defaultParams, ...(axiosConfig.params as Record<string, unknown> | undefined) },
      timeout: API_REQUEST_TIMEOUT_MS,
      baseURL: undefined,
      url: requestUrl.toString(),
    };

    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info(`API request [${preparedConfig.method}]: ${preparedConfig.url}`);
        logger.info(`x-request-id: ${requestId}`);
      }
      const authenticatedResponse = await this.executeAuthenticatedRequest<T>(preparedConfig, token);
      const res = authenticatedResponse.response;

      const location = res.headers.location as string | undefined;
      if (!location) return { data: res.data, message: 'success' };

      const responseUrl = getBoundedLocation(location, requestUrl, boundaryUrl);
      if (skipLocationFollow) return { data: res.data, message: 'success', location: responseUrl };

      const redirectConfig: AuthenticatedRequestConfig = {
        headers: {
          ...preparedConfig.headers,
          Authorization: `Bearer ${authenticatedResponse.token}`,
        },
        maxRedirects: 0,
        method: 'GET',
        timeout: API_REQUEST_TIMEOUT_MS,
        url: responseUrl,
      };
      const getRes = await this.executeAuthenticatedRequest<T>(redirectConfig, authenticatedResponse.token);

      return { data: getRes.response.data, message: 'success' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const response = axios.isAxiosError(error) ? error.response : undefined;
      if (response?.status === 404) {
        logAxiosErrorResponse(response);
        throw new HttpException(404, 'Not found');
      }
      if (response && propagateClientError && response.status >= 400 && response.status < 500 && response.status !== 401) {
        logAxiosErrorResponse(response);
        throw new HttpException(response.status, 'Upstream request rejected');
      }
      if (response?.data) {
        logAxiosErrorResponse(response);
      } else {
        logger.error(`Unknown API error: ${error instanceof Error ? error.name : 'non-error rejection'}`);
      }
      // NOTE: did you subscribe to the API called?
      throw new HttpException(500, 'Internal server error from gateway');
    }
  }

  public async get<T>(config: ApiRequestConfig, sender: Sender): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET' }, sender);
  }

  public async post<T>(config: ApiRequestConfig, sender: Sender): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST' }, sender);
  }

  public async put<T>(config: ApiRequestConfig, sender: Sender): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT' }, sender);
  }

  public async patch<T>(config: ApiRequestConfig, sender: Sender): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH' }, sender);
  }

  public async delete<T>(config: ApiRequestConfig, sender: Sender): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE' }, sender);
  }
}

export default ApiService;
