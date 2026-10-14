import { Request } from 'express';

import { serviceNamespaces } from '@/config/service-namespaces';
import { HttpException } from '@/exceptions/HttpException';

/** Sent by the frontend on every API call; holds the route prefix of the form the page belongs to. */
export const SERVICE_KEY_HEADER = 'x-service-key';

/** The form the request acts for and its namespace. Fails closed: no header or an unknown key is a client error. */
const resolveService = (req: Request): [key: string, namespace: string] => {
  const key = req.headers[SERVICE_KEY_HEADER];
  const namespace = typeof key === 'string' ? serviceNamespaces.get(key) : undefined;
  if (typeof key !== 'string' || namespace === undefined) {
    throw new HttpException(400, 'Unknown service');
  }

  return [key, namespace];
};

export const requireServiceKey = (req: Request): string => resolveService(req)[0];

export const requireNamespace = (req: Request): string => resolveService(req)[1];
