import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ApiService from '@/services/api.service';
import ApiTokenService from '@/services/api-token.service';

import { mockCitizenPartyId } from './helpers/mock-data';

const citizenSender = { user: { partyId: mockCitizenPartyId } };

let allowedServer: Server;
let attackerServer: Server;
let allowedBaseUrl: string;
let attackerUrl: string;
let allowedAuthorization: string | undefined;
let attackerRequestCount = 0;

const listen = async (server: Server): Promise<number> => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
};

const close = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
};

beforeAll(async () => {
  allowedServer = createServer((request, response) => {
    allowedAuthorization = request.headers.authorization;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ ok: true }));
  });
  attackerServer = createServer((_request, response) => {
    attackerRequestCount += 1;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ captured: true }));
  });

  const [allowedPort, attackerPort] = await Promise.all([listen(allowedServer), listen(attackerServer)]);
  allowedBaseUrl = `http://127.0.0.1:${allowedPort}/gateway`;
  attackerUrl = `http://127.0.0.1:${attackerPort}/capture`;
});

afterAll(async () => {
  await Promise.all([close(allowedServer), close(attackerServer)]);
});

beforeEach(() => {
  allowedAuthorization = undefined;
  attackerRequestCount = 0;
  vi.restoreAllMocks();
  vi.spyOn(ApiTokenService.prototype, 'getToken').mockResolvedValue('integration-test-token');
});

describe('ApiService effective URL boundary', () => {
  it('sends credentials to a canonical relative URL beneath baseURL', async () => {
    await expect(
      new ApiService().get(
        {
          baseURL: allowedBaseUrl,
          url: '/resource',
          headers: { authorization: 'Bearer caller-controlled-token' },
        },
        citizenSender,
      ),
    ).resolves.toMatchObject({ data: { ok: true } });

    expect(allowedAuthorization).toBe('Bearer integration-test-token');
  });

  it('preserves an encoded percent sign in a legitimate query value', async () => {
    await expect(
      new ApiService().get(
        {
          baseURL: allowedBaseUrl,
          url: '/resource?filter=status%3A%2750%25%27',
        },
        citizenSender,
      ),
    ).resolves.toMatchObject({ data: { ok: true } });

    expect(allowedAuthorization).toBe('Bearer integration-test-token');
  });

  it('rejects an absolute request URL before credentials can reach another origin', async () => {
    const tokenSpy = vi.spyOn(ApiTokenService.prototype, 'getToken');

    await expect(new ApiService().get({ baseURL: allowedBaseUrl, url: attackerUrl }, citizenSender)).rejects.toMatchObject({
      status: 500,
      message: 'Invalid upstream request URL',
    });

    expect(tokenSpy).not.toHaveBeenCalled();
    expect(attackerRequestCount).toBe(0);
  });

  it.each(['../outside-service', '..%2F..%2Foutside-service', '%252e%252e%252foutside-service', '%252525', '%ZZ'])(
    'rejects a normalized or encoded URL that escapes the configured service path: %s',
    async requestPath => {
      const tokenSpy = vi.spyOn(ApiTokenService.prototype, 'getToken');

      await expect(new ApiService().get({ baseURL: allowedBaseUrl, url: requestPath }, citizenSender)).rejects.toMatchObject({
        status: 500,
        message: 'Invalid upstream request URL',
      });

      expect(tokenSpy).not.toHaveBeenCalled();
      expect(allowedAuthorization).toBeUndefined();
    },
  );

  it.each(['/../outside-service', '/..%2Foutside-service', '/%252e%252e%252foutside-service', '/%252525'])(
    'does not forward credentials when a Location escapes the configured service path: %s',
    async location => {
      const redirectServer = createServer((_request, response) => {
        response.statusCode = 201;
        response.setHeader('Location', location);
        response.end();
      });
      const redirectPort = await listen(redirectServer);
      const serviceBaseUrl = `http://127.0.0.1:${redirectPort}/gateway`;

      try {
        await expect(new ApiService().post({ baseURL: serviceBaseUrl, url: '/resource' }, citizenSender)).rejects.toMatchObject({
          status: 502,
          message: 'Invalid upstream redirect',
        });
      } finally {
        await close(redirectServer);
      }
    },
  );

  it('does not forward credentials when an absolute Location leaves the configured origin', async () => {
    const redirectServer = createServer((_request, response) => {
      response.statusCode = 201;
      response.setHeader('Location', attackerUrl);
      response.end();
    });
    const redirectPort = await listen(redirectServer);
    const serviceBaseUrl = `http://127.0.0.1:${redirectPort}/gateway`;

    try {
      await expect(new ApiService().post({ baseURL: serviceBaseUrl, url: '/resource' }, citizenSender)).rejects.toMatchObject({
        status: 502,
        message: 'Invalid upstream redirect',
      });
      expect(attackerRequestCount).toBe(0);
    } finally {
      await close(redirectServer);
    }
  });

  it('follows a service-root-relative Location beneath the configured base path', async () => {
    let followedPath: string | undefined;
    const redirectServer = createServer((request, response) => {
      if (request.method === 'POST') {
        response.statusCode = 201;
        response.setHeader('Location', '/2281/CONTACTCENTER/errands/errand-id');
        response.end();
        return;
      }
      followedPath = request.url;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ id: 'errand-id' }));
    });
    const redirectPort = await listen(redirectServer);
    const serviceBaseUrl = `http://127.0.0.1:${redirectPort}/gateway`;

    try {
      await expect(new ApiService().post({ baseURL: serviceBaseUrl, url: '/resource' }, citizenSender)).resolves.toMatchObject({
        data: { id: 'errand-id' },
      });
      expect(followedPath).toBe('/gateway/2281/CONTACTCENTER/errands/errand-id');
    } finally {
      await close(redirectServer);
    }
  });

  it('leaves the Location unfollowed when the caller opts out', async () => {
    let followed = false;
    const redirectServer = createServer((request, response) => {
      if (request.method === 'POST') {
        response.statusCode = 201;
        response.setHeader('Location', '/2281/CONTACTCENTER/errands/errand-id/attachments/attachment-id');
        response.end();
        return;
      }
      followed = true;
      response.end();
    });
    const redirectPort = await listen(redirectServer);
    const serviceBaseUrl = `http://127.0.0.1:${redirectPort}/gateway`;

    try {
      const res = await new ApiService().post({ baseURL: serviceBaseUrl, url: '/resource', skipLocationFollow: true }, citizenSender);

      expect(followed).toBe(false);
      expect(res.location).toBe(`${serviceBaseUrl}/2281/CONTACTCENTER/errands/errand-id/attachments/attachment-id`);
    } finally {
      await close(redirectServer);
    }
  });
});
