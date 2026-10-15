import { getMetadataArgsStorage } from 'routing-controllers';

import { CONTROLLERS } from '@/controllers';
import authMiddleware from '@/middlewares/auth.middleware';
import { resolvePublic } from '@/middlewares/public.decorator';

export interface RegisteredRoute {
  controllerName: string;
  handlerName: string;
  /** Lowercase express verb, e.g. 'get' | 'post'. */
  httpMethod: string;
  /** Route path as declared, may contain ':param' segments. */
  path: string;
  hasAuthMiddleware: boolean;
  isPublic: boolean;
  publicReason?: string;
}

const buildPath = (controllerRoute: unknown, actionRoute: string | RegExp | undefined): string => {
  const prefix = typeof controllerRoute === 'string' ? controllerRoute : '';
  const route = typeof actionRoute === 'string' ? actionRoute : (actionRoute?.source ?? '');
  return `${prefix}${route}` || '/';
};

export const collectRegisteredRoutes = (): RegisteredRoute[] => {
  const storage = getMetadataArgsStorage();
  const mounted = new Set<unknown>(CONTROLLERS);
  const controllerRouteByTarget = new Map<unknown, unknown>(storage.controllers.map(controller => [controller.target, controller.route]));

  return storage.actions
    .filter(action => mounted.has(action.target))
    .map(action => {
      const { isPublic, reason } = resolvePublic(action.target, action.method);
      return {
        controllerName: (action.target as { name?: string }).name ?? 'unknown',
        handlerName: action.method,
        httpMethod: action.type.toLowerCase(),
        path: buildPath(controllerRouteByTarget.get(action.target), action.route),
        // Method-level @UseBefore on this action, or a class-level one covering all actions.
        hasAuthMiddleware: storage.uses.some(
          use => use.target === action.target && (use.method === undefined || use.method === action.method) && use.middleware === authMiddleware,
        ),
        isPublic,
        publicReason: reason,
      };
    });
};

export const toConcretePath = (path: string): string => path.replace(/:[^/]+/g, '1');
