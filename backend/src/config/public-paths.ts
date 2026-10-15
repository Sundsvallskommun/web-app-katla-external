/**
 * Non-controller Express mounts reachable without authentication.
 * Prefix matching grants a whole subtree, for every method — keep this list minimal.
 */
const PUBLIC_PATH_PREFIXES: readonly string[] = ['/api-docs', '/swagger.json'];

/** Strips a single trailing slash so '/health/up/' matches '/health/up'. Keeps a bare '/'. */
const normalizePath = (path: string): string => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);

/** Express answers HEAD from the matching GET handler, so a public GET has to accept HEAD too. */
const normalizeMethod = (httpMethod: string): string => {
  const upper = httpMethod.toUpperCase();
  return upper === 'HEAD' ? 'GET' : upper;
};

/**
 * Key format for the allow-list built by buildPublicPathSet(). Method-scoped on purpose: the
 * decorator sits on a single handler, so marking GET public must not open POST on the same path.
 */
export const publicRouteKey = (httpMethod: string, path: string): string => `${normalizeMethod(httpMethod)} ${normalizePath(path)}`;

/**
 * True when this method/path pair may be served without an authenticated session.
 * PUBLIC_PATH_PREFIXES matches on a segment boundary — '/api-docs' must not match '/api-docsomething'.
 */
export const isPublicPath = (httpMethod: string, path: string, publicPaths: Set<string>): boolean => {
  if (publicPaths.has(publicRouteKey(httpMethod, path))) {
    return true;
  }

  const normalized = normalizePath(path);

  return PUBLIC_PATH_PREFIXES.some(prefix => normalized === prefix || normalized.startsWith(`${prefix}/`));
};
