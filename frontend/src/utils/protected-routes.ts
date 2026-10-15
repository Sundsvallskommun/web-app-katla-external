import { pathWithoutLocale } from '@app/locale-path';

export const parseProtectedRoutes = (routes: string | undefined): string[] =>
  (routes ?? '')
    .split(',')
    .map((route) => route.trim())
    .filter((route) => route !== '');

export const protectedRoutes = parseProtectedRoutes(process.env.NEXT_PUBLIC_PROTECTED_ROUTES);

/** Prefix match, so /alkoholtillstand covers its errand pages. Takes a path from routePath. */
export const isProtectedRoute = (path: string, routes: string[] = protectedRoutes): boolean =>
  routes.some((route) => path === route || path.startsWith(`${route}/`));

/** window.location.pathname keeps the basePath that nextUrl.pathname and usePathname() drop. */
export const routePath = (pathname: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''): string => {
  const unprefixed =
    basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`)) ?
      pathname.slice(basePath.length) || '/'
    : pathname;

  return pathWithoutLocale(unprefixed);
};
