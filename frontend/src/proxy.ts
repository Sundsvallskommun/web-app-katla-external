import i18nConfig from '@app/i18nConfig';
import { pathWithoutLocale } from '@app/locale-path';
import { isProtectedRoute, parseProtectedRoutes } from '@utils/protected-routes';
import { NextRequest, NextResponse } from 'next/server';
import { i18nRouter } from 'next-i18n-router';

import { envs } from '../middleware-envs';

export async function proxy(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;
  // Protected routes and the admin redirect are listed without a language prefix, so compare
  // against the stripped path — otherwise /en/... stops matching and the check is skipped
  // entirely outside the default locale.
  const unprefixedPathname = pathWithoutLocale(pathname);

  if (unprefixedPathname === '/admin') {
    return NextResponse.redirect(new URL(envs.adminUrl));
  }

  if (isProtectedRoute(unprefixedPathname, parseProtectedRoutes(envs.protectedRoutes))) {
    const cookieName = envs.sessionCookieName;
    const token = req.cookies.get(cookieName)?.value ?? '';

    const response = await fetch(`${envs.apiUrl}/me`, {
      cache: 'no-cache',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: `${cookieName}=${encodeURIComponent(token)}`,
      },
    });

    if (response.status === 401) {
      const loginUrl = new URL(`${envs.basePath}/login`, origin);
      // The login page feeds this to appURL(), which only prepends the origin.
      loginUrl.searchParams.set('path', `${envs.basePath}${pathname}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  req.headers.set('x-path', pathname);
  return i18nRouter(req, i18nConfig);
}

export const config = {
  matcher: '/((?!api|static|.*\\..*|_next).*)',
};
