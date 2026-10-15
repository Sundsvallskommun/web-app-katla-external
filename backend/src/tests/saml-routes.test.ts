import { Strategy } from '@node-saml/passport-saml';
import express from 'express';
import passport from 'passport';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { IndexController } from '@/controllers/index.controller';

type SamlAuthenticationCallback = (error: unknown, user?: Express.User | false | null, info?: unknown) => void;

const mockSamlAuthentication = (error: unknown, user?: Express.User | false | null, loginError?: Error, info?: unknown): void => {
  vi.spyOn(passport, 'authenticate').mockImplementation(((_strategy: string, optionsOrCallback?: unknown) => {
    if (typeof optionsOrCallback !== 'function') {
      return (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
        next();
      };
    }

    const callback = optionsOrCallback as SamlAuthenticationCallback;
    return (req: express.Request) => {
      if (loginError) {
        Object.defineProperty(req, 'login', {
          configurable: true,
          value: (_user: Express.User, done: (loginResult?: unknown) => void) => {
            done(loginError);
          },
        });
      }
      callback(error, user, info);
    };
  }) as typeof passport.authenticate);
};

// The real logout url is signed with a private key the test env does not have.
const mockSamlLogout = (url: string | null, error: Error | null = null): void => {
  vi.spyOn(Strategy.prototype, 'logout').mockImplementation((_req, callback) => {
    callback(error, url);
  });
};

// Outside BASE_URL_PREFIX on purpose: the default-deny guard covers everything under it.
const seedLoggedInCitizen = async (app: express.Application): Promise<ReturnType<typeof request.agent>> => {
  app.get('/seed-user', (req, res) => {
    req.login({ nameID: 'citizen@idp', nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', sessionIndex: 'session-1' }, err => {
      res.sendStatus(err ? 500 : 204);
    });
  });

  const agent = request.agent(app);
  await agent.get('/seed-user').expect(204);
  return agent;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SAML callback redirects', () => {
  it('uses the configured fallback when RelayState is missing', async () => {
    mockSamlAuthentication({ name: 'SAML_INVALID_RESPONSE' });
    const app = new App([IndexController]).getServer();

    const response = await request(app).post('/api/saml/login/callback').type('form').send({}).expect(302);

    expect(response.headers.location).toBe('http://localhost:3000/?failMessage=SAML_INVALID_RESPONSE');
  });

  it('rejects an untrusted success redirect while preserving an allowed failure redirect', async () => {
    mockSamlAuthentication(undefined, false);
    const app = new App([IndexController]).getServer();

    const response = await request(app)
      .post('/api/saml/login/callback')
      .type('form')
      .send({ RelayState: 'https://evil.example/success,http://localhost:3000/failure' })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:3000/failure?failMessage=NO_USER');
  });

  it('reports why the verification refused the user instead of a bare NO_USER', async () => {
    mockSamlAuthentication(undefined, false, undefined, { name: 'SAML_MISSING_CITIZEN_IDENTIFIER', message: 'Missing citizen identifier' });
    const app = new App([IndexController]).getServer();

    const response = await request(app).post('/api/saml/login/callback').type('form').send({}).expect(302);

    expect(response.headers.location).toBe('http://localhost:3000/?failMessage=SAML_MISSING_CITIZEN_IDENTIFIER');
  });

  it('redirects exactly once when req.login fails', async () => {
    mockSamlAuthentication(undefined, {}, new Error('login failed'));
    const redirectSpy = vi.spyOn(express.response, 'redirect');
    const app = new App([IndexController]).getServer();

    const response = await request(app)
      .post('/api/saml/login/callback')
      .type('form')
      .send({ RelayState: 'http://localhost:3000/success,http://localhost:3000/failure' })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:3000/failure?failMessage=SAML_UNKNOWN_ERROR');
    expect(redirectSpy.mock.calls).toHaveLength(1);
  });

  it('uses the success redirect for logout unless the session contains a real failure message', async () => {
    const app = new App([IndexController]).getServer();

    const successResponse = await request(app)
      .get('/api/saml/logout/callback')
      .type('form')
      .send({ RelayState: 'http://localhost:3000/success,http://localhost:3000/failure' })
      .expect(302);

    expect(successResponse.headers.location).toBe('http://localhost:3000/success');

    // Outside BASE_URL_PREFIX on purpose: the default-deny guard covers everything under the
    // prefix, including routes appended after construction.
    app.get('/seed-saml-error', (req, res) => {
      req.session.messages = ['SAML_LOGOUT_FAILED'];
      res.sendStatus(204);
    });
    const agent = request.agent(app);
    await agent.get('/seed-saml-error').expect(204);

    const failureResponse = await agent
      .get('/api/saml/logout/callback')
      .type('form')
      .send({ RelayState: 'http://localhost:3000/success,http://localhost:3000/failure' })
      .expect(302);

    expect(failureResponse.headers.location).toBe('http://localhost:3000/failure?failMessage=SAML_LOGOUT_FAILED');
  });
});

describe('SAML single logout', () => {
  it('sends the browser to the IdP so the session ends there too, and comes back to the app', async () => {
    mockSamlLogout('http://localhost:4000/logout?SAMLRequest=encoded-request');
    const app = new App([IndexController]).getServer();
    const agent = await seedLoggedInCitizen(app);

    const response = await agent.get('/api/saml/logout').query({ successRedirect: 'http://localhost:3000/login?loggedout' }).expect(302);

    const location = new URL(response.headers.location ?? '');
    expect(`${location.origin}${location.pathname}`).toBe('http://localhost:4000/logout');
    expect(location.searchParams.get('SAMLRequest')).toBe('encoded-request');
    expect(location.searchParams.get('RelayState')).toBe('http://localhost:3000/login?loggedout');
  });

  it('ends the local session anyway when the IdP logout url cannot be built', async () => {
    mockSamlLogout(null, new Error('missing nameID'));
    const app = new App([IndexController]).getServer();
    const agent = await seedLoggedInCitizen(app);

    const response = await agent.get('/api/saml/logout').query({ successRedirect: 'http://localhost:3000/login?loggedout' }).expect(302);

    expect(response.headers.location).toBe('http://localhost:3000/login?loggedout');
  });

  it('logs a refused login out of the IdP, which still holds a session for it', async () => {
    mockSamlLogout('http://localhost:4000/logout?SAMLRequest=encoded-request');
    mockSamlAuthentication(undefined, false, undefined, {
      name: 'SAML_MISSING_CITIZEN_IDENTIFIER',
      message: 'Missing citizen identifier',
      samlIdentity: { nameID: 'employee@idp', nameIDFormat: 'urn:unspecified', sessionIndex: 'session-1' },
    });
    const app = new App([IndexController]).getServer();
    const agent = request.agent(app);

    await agent.post('/api/saml/login/callback').type('form').send({}).expect(302);
    const response = await agent.get('/api/saml/logout').query({ successRedirect: 'http://localhost:3000/login?loggedout' }).expect(302);

    expect(response.headers.location).toContain('http://localhost:4000/logout');
  });

  it('skips the IdP round trip when there is no logged in user to log out', async () => {
    const logoutSpy = vi.spyOn(Strategy.prototype, 'logout');
    const app = new App([IndexController]).getServer();

    const response = await request(app).get('/api/saml/logout').query({ successRedirect: 'http://localhost:3000/login?loggedout' }).expect(302);

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(response.headers.location).toBe('http://localhost:3000/login?loggedout');
  });

  it('reads the RelayState the IdP returns on the redirect binding', async () => {
    const app = new App([IndexController]).getServer();

    const response = await request(app)
      .get('/api/saml/logout/callback')
      .query({ RelayState: 'http://localhost:3000/success,http://localhost:3000/failure' })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:3000/success');
  });
});
