// Swagger must stay reachable without a session — it was public before the default-deny guard,
// and locking it would be a regression.
//
// The interesting case is not the /api-docs HTML but the assets beneath it: Swagger UI is served
// by `swaggerUi.serve`, which includes express.static(...), so the page pulls swagger-ui.css and
// swagger-ui-bundle.js from the same mount. An exact-match allow-list would return the HTML shell
// and 401 every asset, leaving a blank page rather than an honest error.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { BASE_URL_PREFIX } from '@/config';
import { CONTROLLERS } from '@/controllers';

import { startServer, TestServer } from './helpers/server';

// config reads SWAGGER_ENABLED into a module-level const at import time, and imports are hoisted
// above ordinary top-level statements. vi.hoisted runs before them, so the flag is set in time.
vi.hoisted(() => {
  process.env.SWAGGER_ENABLED = 'true';
});

vi.mock('@/services/api.service', () => {
  const stub = vi.fn(() => Promise.resolve({ data: {} }));
  return {
    default: class {
      get = stub;
      post = stub;
      patch = stub;
      put = stub;
      delete = stub;
    },
  };
});

describe('default-deny auth (swagger)', () => {
  let server: TestServer;
  const prefix = BASE_URL_PREFIX ?? '';

  beforeAll(async () => {
    server = await startServer(new App(CONTROLLERS).getServer());
  });

  afterAll(() => server.close());

  it('mounts swagger at all (guards the rest of this suite from passing vacuously)', async () => {
    const response = await server.request('get', `${prefix}/api-docs/`);

    expect(response.status).toBe(200);
  });

  it.each([
    ['the UI entry point', '/api-docs/'],
    ['the generated init script', '/api-docs/swagger-ui-init.js'],
    ['a static stylesheet', '/api-docs/swagger-ui.css'],
    ['a static bundle', '/api-docs/swagger-ui-bundle.js'],
    ['the raw spec', '/swagger.json'],
  ])('serves %s without a session', async (_label, path) => {
    const response = await server.request('get', `${prefix}${path}`);

    expect(response.status).not.toBe(401);
  });

  it('does not open sibling paths that merely share a prefix', async () => {
    const response = await server.request('get', `${prefix}/api-docsomething`);

    expect(response.status).toBe(401);
  });
});
