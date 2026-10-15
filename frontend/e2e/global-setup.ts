import type { FullConfig } from '@playwright/test';

import { SERVICE_PATH } from './utils/service';

const PROBE_PATH = SERVICE_PATH;
const PROBE_TIMEOUT_MS = 60_000;

const PROTECTED_TARGET_MESSAGE = `The target server redirects ${PROBE_PATH} to /login, so every spec would fail on missing elements.

The Next middleware (src/proxy.ts) calls the backend /me server-side for every route in
NEXT_PUBLIC_PROTECTED_ROUTES, and Playwright can only mock what the browser asks for. Set

  NEXT_PUBLIC_PROTECTED_ROUTES=""

in frontend/.env, regenerate middleware-envs.js and restart the dev server. See Testing in
CLAUDE.md.`;

/** Explains an unusable target once instead of letting it surface as a wall of timeouts. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;

  let response: Response;
  try {
    response = await fetch(`${baseURL}${PROBE_PATH}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Could not reach ${baseURL}${PROBE_PATH}: ${String(error)}`);
  }

  if ((response.headers.get('location') ?? '').includes('/login')) {
    throw new Error(PROTECTED_TARGET_MESSAGE);
  }
}
