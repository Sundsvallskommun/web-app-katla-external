import authMiddleware from '@middlewares/auth.middleware';
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { isPublicPath } from '@/config/public-paths';

/**
 * App-level default-deny authentication.
 *
 * Closes over the set of public paths built at startup from the Public decorators. Mounted once
 * in app.ts before the routing-controllers routes are registered, so every route is
 * authenticated unless its handler is marked public.
 */
export const createDefaultAuthGuard =
  (publicPaths: Set<string>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    if (isPublicPath(req.method, req.path, publicPaths)) {
      next();
      return;
    }

    authMiddleware(req, res, next);
  };
