import { getMetadataArgsStorage } from 'routing-controllers';

import { publicRouteKey } from '@/config/public-paths';

export interface PublicRouteInfo {
  path: string;
  httpMethod: string;
  controller: string;
  action: string;
  reason?: string;
}

const publicClasses = new Map<unknown, string | undefined>();
const publicMethods = new Map<unknown, Map<string, string | undefined>>();

/**
 * Marks a controller action (or every action on a controller) as reachable without an
 * authenticated session. Everything else requires auth by default.
 */
export function Public(reason?: string): MethodDecorator & ClassDecorator {
  return (target: object, propertyKey?: string | symbol): void => {
    if (propertyKey === undefined) {
      publicClasses.set(target, reason);
      return;
    }
    const ctor: unknown = typeof target === 'function' ? target : (target as { constructor: unknown }).constructor;
    let methods = publicMethods.get(ctor);
    if (!methods) {
      methods = new Map();
      publicMethods.set(ctor, methods);
    }
    methods.set(String(propertyKey), reason);
  };
}

export function resolvePublic(target: unknown, method: string): { isPublic: boolean; reason?: string } {
  if (publicClasses.has(target)) return { isPublic: true, reason: publicClasses.get(target) };
  const methods = publicMethods.get(target);
  if (methods?.has(method)) return { isPublic: true, reason: methods.get(method) };
  return { isPublic: false };
}

/**
 * Call this after controllers have been imported (their decorators must have run) and before
 * the Express server starts accepting requests.
 */
export function buildPublicPathSet(controllers: (new (...args: never[]) => object)[]): { paths: Set<string>; routes: PublicRouteInfo[] } {
  const storage = getMetadataArgsStorage();
  const mounted = new Set<unknown>(controllers);
  const controllerRouteByTarget = new Map<unknown, unknown>(storage.controllers.map(controller => [controller.target, controller.route]));
  const routes: PublicRouteInfo[] = [];

  for (const action of storage.actions) {
    if (!mounted.has(action.target)) continue;
    const { isPublic, reason } = resolvePublic(action.target, action.method);
    if (!isPublic) continue;

    const controllerRoute = controllerRouteByTarget.get(action.target);
    const prefix = typeof controllerRoute === 'string' ? controllerRoute : '';
    const route = typeof action.route === 'string' ? action.route : (action.route?.source ?? '');
    routes.push({
      path: `${prefix}${route}` || '/',
      httpMethod: action.type.toUpperCase(),
      controller: (action.target as { name?: string }).name ?? 'unknown',
      action: action.method,
      reason,
    });
  }

  return { paths: new Set(routes.map(route => publicRouteKey(route.httpMethod, route.path))), routes };
}
