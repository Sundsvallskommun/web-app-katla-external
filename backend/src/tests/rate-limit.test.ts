// The global per-IP limiter is a backstop; these are the tighter rules on the routes an
// attacker would actually lean on. The limiters are module singletons shared by every App, so
// each test resets the keys it uses. Login goes through a helper route outside BASE_URL_PREFIX
// (the guard covers everything under it) so the per-citizen keys can be exercised over real HTTP.

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { BASE_URL_PREFIX } from '@/config';
import { CitizenController } from '@/controllers/citizen.controller';
import { HealthController } from '@/controllers/health.controller';
import { IndexController } from '@/controllers/index.controller';
import { SupportManagementController } from '@/controllers/supportmanagement.controller';
import {
  authFlowRateLimit,
  citizenOrIpKey,
  globalRateLimit,
  healthRateLimit,
  personLookupRateLimit,
  writeRateLimit,
} from '@/middlewares/rate-limit.middleware';

import { mockCitizenPartyId, mockOtherCitizenPartyId, mockPersonNumber, mockServiceKey } from './helpers/mock-data';

vi.mock('@/services/api.service', () => {
  const stub = vi.fn(() => Promise.resolve({ data: { status: 'OK' } }));
  return {
    NO_SESSION_SENDER: Symbol('no-session'),
    default: class {
      get = stub;
      post = stub;
      patch = stub;
      put = stub;
      delete = stub;
    },
  };
});

const prefix = BASE_URL_PREFIX ?? '';

// supertest connects over the loopback, which is what every ip-keyed limiter sees.
const testKeys = ['127.0.0.1', `party:${mockCitizenPartyId}`, `party:${mockOtherCitizenPartyId}`];

beforeEach(() => {
  for (const limiter of [globalRateLimit, authFlowRateLimit, healthRateLimit, personLookupRateLimit, writeRateLimit]) {
    for (const key of testKeys) limiter.resetKey(key);
  }
});

type Controllers = ConstructorParameters<typeof App>[0];

/** The app plus a login route that persists any user into the session, as the SAML callback would. */
const bootApp = (controllers: Controllers): express.Application => {
  const app = new App(controllers).getServer();
  app.post('/test-login', express.json(), (req, res, next) => {
    req.login(req.body as Express.User, err => {
      if (err) {
        next(err);
        return;
      }
      res.sendStatus(204);
    });
  });
  return app;
};

const loginAs = async (app: express.Application, partyId: string) => {
  const agent = request.agent(app);
  await agent.post('/test-login').send({ partyId, personNumber: mockPersonNumber, name: 'Test' }).expect(204);
  return agent;
};

const expectExhausted = async (send: () => request.Test, limit: number, okStatus: number): Promise<void> => {
  for (let hit = 0; hit < limit; hit += 1) {
    const response = await send();
    expect(response.status, `hit ${String(hit + 1)} of ${String(limit)}`).toBe(okStatus);
  }

  const response = await send();
  expect(response.status).toBe(429);
  expect(response.body).toEqual({ message: 'TOO_MANY_REQUESTS' });
  expect(response.headers['retry-after']).toBeDefined();
};

describe('rate limit keys', () => {
  it('keys a logged in citizen on the party id and everyone else on the ip', () => {
    const asCitizen = { user: { partyId: mockCitizenPartyId }, ip: '203.0.113.7' } as unknown as express.Request;
    const anonymous = { ip: '203.0.113.7' } as unknown as express.Request;
    const anonymousV6 = { ip: '2001:db8:1234:5678:9abc:def0:1234:5678' } as unknown as express.Request;

    expect(citizenOrIpKey(asCitizen)).toBe(`party:${mockCitizenPartyId}`);
    expect(citizenOrIpKey(anonymous)).toBe('203.0.113.7');
    // A /56 bucket, so an attacker with a whole IPv6 prefix does not get a fresh counter per address.
    expect(citizenOrIpKey(anonymousV6)).not.toContain('9abc');
  });
});

describe('rate limits on the SAML routes', () => {
  it('cuts off the auth flow after 60 hits from one ip', async () => {
    const app = new App([IndexController]).getServer();

    // Logout without a session only ends the local session and redirects, so it is a safe probe.
    await expectExhausted(() => request(app).get(`${prefix}/saml/logout`), 60, 302);
  });
});

describe('rate limits on the public health probe', () => {
  it('cuts off the probe after 60 hits per minute from one ip', async () => {
    const app = new App([HealthController]).getServer();

    await expectExhausted(() => request(app).get(`${prefix}/health/up`), 60, 200);
  });
});

describe('rate limits on the person lookup', () => {
  it('cuts one citizen off after 30 lookups without touching another citizen on the same ip', async () => {
    const app = bootApp([CitizenController]);
    const citizen = await loginAs(app, mockCitizenPartyId);
    const neighbour = await loginAs(app, mockOtherCitizenPartyId);
    const lookup = (agent: ReturnType<typeof request.agent>) => agent.get(`${prefix}/citizen/person/${mockPersonNumber}`);

    // The stubbed Citizen response has no address, so the handler answers null (204); only the 429 counts.
    await expectExhausted(() => lookup(citizen), 30, 204);

    expect((await lookup(neighbour)).status).toBe(204);
  });

  it('does not count unauthenticated attempts against the lookup budget', async () => {
    const app = bootApp([CitizenController]);

    await request(app).get(`${prefix}/citizen/person/${mockPersonNumber}`).expect(401);

    const citizen = await loginAs(app, mockCitizenPartyId);
    const response = await citizen.get(`${prefix}/citizen/person/${mockPersonNumber}`);
    expect(response.headers['ratelimit-remaining']).toBe('29');
  });
});

describe('rate limits on errand writes', () => {
  it('cuts a citizen off after 60 errand creations', async () => {
    const app = bootApp([SupportManagementController]);
    const citizen = await loginAs(app, mockCitizenPartyId);
    const create = () => citizen.post(`${prefix}/supportmanagement/errand/create`).set('x-service-key', mockServiceKey).send({});

    // The handler itself rejects the empty body; only the limiter answers 429, which is what counts.
    const first = await create();
    expect(first.status).not.toBe(429);
    for (let hit = 1; hit < 60; hit += 1) {
      expect((await create()).status).toBe(first.status);
    }

    expect((await create()).status).toBe(429);
  });
});
