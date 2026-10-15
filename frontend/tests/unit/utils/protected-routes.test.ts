import { isProtectedRoute, parseProtectedRoutes, routePath } from '@utils/protected-routes';
import { describe, expect, it } from 'vitest';

const routes = parseProtectedRoutes('/alkoholtillstand');

describe('parseProtectedRoutes', () => {
  it('drops the empty entries an unset env var would otherwise produce', () => {
    expect(parseProtectedRoutes('')).toEqual([]);
    expect(parseProtectedRoutes(undefined)).toEqual([]);
    expect(parseProtectedRoutes(' /oversikt , /alkoholtillstand ,')).toEqual(['/oversikt', '/alkoholtillstand']);
  });
});

describe('isProtectedRoute', () => {
  it('guards the listed pages and everything nested under them', () => {
    expect(isProtectedRoute('/alkoholtillstand/oversikt', routes)).toBe(true);
    expect(isProtectedRoute('/alkoholtillstand', routes)).toBe(true);
    expect(isProtectedRoute('/alkoholtillstand/arende/AOT-26090002/grundinformation', routes)).toBe(true);
  });

  it('leaves the public pages alone', () => {
    expect(isProtectedRoute('/', routes)).toBe(false);
    expect(isProtectedRoute('/login', routes)).toBe(false);
    expect(isProtectedRoute('/logout', routes)).toBe(false);
  });

  it('does not match a route that merely starts with the same characters', () => {
    expect(isProtectedRoute('/alkoholtillstandet', routes)).toBe(false);
  });

  it('guards nothing when the list is empty', () => {
    expect(isProtectedRoute('/oversikt', [])).toBe(false);
  });
});

describe('routePath', () => {
  it('strips the basePath that window.location.pathname carries', () => {
    expect(routePath('/registrering/aot/oversikt', '/registrering/aot')).toBe('/oversikt');
    expect(routePath('/registrering/aot', '/registrering/aot')).toBe('/');
  });

  it('leaves a path that already lacks the basePath untouched', () => {
    expect(routePath('/oversikt', '/registrering/aot')).toBe('/oversikt');
  });

  it('strips the language prefix as well', () => {
    expect(routePath('/registrering/aot/en/oversikt', '/registrering/aot')).toBe('/oversikt');
  });

  it('does not strip a basePath that is only a partial segment match', () => {
    expect(routePath('/registrering/aotx/oversikt', '/registrering/aot')).toBe('/registrering/aotx/oversikt');
  });
});
