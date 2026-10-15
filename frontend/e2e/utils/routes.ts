import type { Route } from '@playwright/test';

// API calls go to the backend on another port (cross-origin), so mocked responses need CORS
// headers because axios calls with withCredentials.
const corsHeaders = (route: Route): Record<string, string> => {
  const origin = route.request().headers().origin;
  return origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } : {};
};

const fulfill = (route: Route, status: number, json?: unknown) => {
  const headers = corsHeaders(route);
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({
      status: 204,
      headers: {
        ...headers,
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': route.request().headers()['access-control-request-headers'] ?? '*',
      },
    });
  }
  return json === undefined ? route.fulfill({ status, headers }) : route.fulfill({ status, json, headers });
};

/** Responds with JSON. */
export const jsonRoute =
  (json: unknown, status = 200) =>
  (route: Route) =>
    fulfill(route, status, json);

/** Responds with an empty body, e.g. 204 No Content. */
export const emptyRoute =
  (status = 204) =>
  (route: Route) =>
    fulfill(route, status);
