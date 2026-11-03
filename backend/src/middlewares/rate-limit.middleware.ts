import { Request } from 'express';
import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

/**
 * Keys a logged in citizen on their party id, so a shared NAT never throttles one citizen for
 * another's traffic. Before login (and on the public routes) the client IP is all there is.
 */
export const citizenOrIpKey = (req: Request): string => {
  const partyId = (req.user as { partyId?: unknown } | undefined)?.partyId;
  return typeof partyId === 'string' && partyId !== '' ? `party:${partyId}` : ipKeyGenerator(req.ip ?? '');
};

/** Each limiter owns its store and window; the key is shared so the rules compose per citizen. */
const createRateLimit = (limit: number, windowMs: number): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: citizenOrIpKey,
    standardHeaders: true,
    legacyHeaders: false,
    // Same shape as errorMiddleware, so the client reads one error contract.
    message: { message: 'TOO_MANY_REQUESTS' },
  });

/** Backstop for every route. Mounted before the session, so it always keys on the client IP. */
export const globalRateLimit = createRateLimit(1000, FIFTEEN_MINUTES);

/** The SAML round trips: XML parsing, signature checks and a Citizen lookup on every login. */
export const authFlowRateLimit = createRateLimit(60, FIFTEEN_MINUTES);

/** Public liveness probe that costs an upstream call per hit. */
export const healthRateLimit = createRateLimit(60, ONE_MINUTE);

/** Resolves any citizen's name and address from a person number - an enumeration oracle. */
export const personLookupRateLimit = createRateLimit(30, FIFTEEN_MINUTES);

/** Errand creation and attachment uploads: each hit writes upstream, an upload holds up to 50 MB in memory. */
export const writeRateLimit = createRateLimit(60, FIFTEEN_MINUTES);
