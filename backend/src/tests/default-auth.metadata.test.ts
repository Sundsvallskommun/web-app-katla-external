// Source-level guard for the default-deny auth model: every registered route must either carry
// authMiddleware or be marked @Public(). Catches a new unauthenticated route at the point it is
// added, without booting the app. The runtime counterpart proves the guard actually denies.

import { describe, expect, it } from 'vitest';

import { CONTROLLERS } from '@/controllers';

import { collectRegisteredRoutes } from './helpers/routes';

describe('default-deny auth (metadata)', () => {
  const routes = collectRegisteredRoutes();

  it('registers routes for every mounted controller', () => {
    expect(routes.length).toBeGreaterThan(0);

    const controllersWithRoutes = new Set(routes.map(route => route.controllerName));
    expect(controllersWithRoutes.size).toBe(CONTROLLERS.length);
  });

  it('has no route that is both unauthenticated and not marked @Public()', () => {
    const unguarded = routes
      .filter(route => !route.hasAuthMiddleware && !route.isPublic)
      .map(route => `${route.httpMethod.toUpperCase()} ${route.path} (${route.controllerName}.${route.handlerName})`);

    expect(unguarded).toEqual([]);
  });

  it('has no route marked both @Public() and @UseBefore(authMiddleware)', () => {
    const contradictory = routes
      .filter(route => route.isPublic && route.hasAuthMiddleware)
      .map(route => `${route.httpMethod.toUpperCase()} ${route.path}`);

    expect(contradictory).toEqual([]);
  });

  it('pins the set of public routes with their stated reasons', () => {
    const publicSurface = routes
      .filter(route => route.isPublic)
      .map(route => `${route.httpMethod.toUpperCase()} ${route.path} // ${route.publicReason ?? 'no reason given'}`)
      .sort();

    expect(publicSurface).toEqual([
      'GET / // Service root - returns a constant, no user context',
      'GET /health/up // Liveness probe - polled by infrastructure without a session',
    ]);
  });
});
