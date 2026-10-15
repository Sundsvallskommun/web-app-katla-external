import request from 'supertest';
import { describe, expect, it } from 'vitest';

import App, { getSessionCookieOptions, getSessionCookiePath } from '@/app';
import { IndexController } from '@/controllers/index.controller';
import { localApi } from '@/utils/util';

describe('security middleware', () => {
  it('uses secure session cookies in production', () => {
    expect(getSessionCookieOptions('production')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    expect(getSessionCookieOptions('test').secure).toBe(false);
  });

  it('lets ENVIRONMENT=LOCAL turn off the secure flag for local http builds', () => {
    expect(getSessionCookieOptions('production', 'LOCAL').secure).toBe(false);
    // Everything but LOCAL keeps Secure — especially unset, which is the production case.
    expect(getSessionCookieOptions('production', 'TEST').secure).toBe(true);
    expect(getSessionCookieOptions('production', '').secure).toBe(true);
    expect(getSessionCookieOptions('production', undefined).secure).toBe(true);
    // LOCAL must not turn Secure on outside production.
    expect(getSessionCookieOptions('development', 'LOCAL').secure).toBe(false);
  });

  it('sets hardened attributes on a persisted session cookie', async () => {
    const app = new App([IndexController]).getServer();
    // Outside BASE_URL_PREFIX on purpose: the default-deny guard covers everything under the
    // prefix, including routes appended after construction. The session cookie path is '/' in
    // tests, so the cookie is still set here.
    app.get('/session-test', (req, res) => {
      req.session.returnTo = '/';
      res.sendStatus(204);
    });

    const response = await request(app).get('/session-test').expect(204);
    const cookies = response.headers['set-cookie'];
    if (!Array.isArray(cookies)) {
      throw new Error('Expected one persisted session cookie');
    }
    if (typeof cookies[0] !== 'string') {
      throw new Error('Expected one persisted session cookie');
    }
    const cookie = cookies[0];

    expect(cookies).toHaveLength(1);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    // getSessionCookiePath owns the cookie path, which must cover the whole app rather than the
    // API prefix: the Next middleware reads the cookie on UI paths, and one scoped to /api is
    // never sent there (RFC 6265 §5.1.4). This asserts the session middleware really uses the
    // helper, so a regression to a hardcoded prefix shows up here, not as a login loop.
    expect(cookie).toContain(`Path=${getSessionCookiePath()}`);
    expect(getSessionCookiePath().startsWith('/api')).toBe(false);
  });

  // A cross-site POST from the IdP (the SAML callback) carries an Origin that is never in the
  // ORIGIN whitelist. CORS must then simply omit Access-Control-Allow-Origin, not reject the
  // request: throwing gives a 500 "Not allowed by CORS" and login never completes.
  it('does not reject requests from a non-whitelisted origin', async () => {
    const app = new App([IndexController]).getServer();

    const response = await request(app).get(localApi('/')).set('Origin', 'https://idp.example.com');

    expect(response.status).not.toBe(500);
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('reflects the allow-origin header for a whitelisted origin', async () => {
    const app = new App([IndexController]).getServer();

    const response = await request(app).get(localApi('/')).set('Origin', 'http://localhost:3000').expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('publishes standard rate-limit headers without legacy headers', async () => {
    const app = new App([IndexController]);
    const response = await request(app.getServer()).get(localApi('/')).expect(200);

    expect(response.headers['ratelimit-policy']).toContain('1000;w=900');
    expect(response.headers['ratelimit-limit']).toBe('1000');
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });
});
