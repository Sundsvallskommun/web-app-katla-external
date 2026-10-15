// Boots an express app on an ephemeral port so a test can make real HTTP requests through the
// production middleware chain.

import http from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Application } from 'express';

export interface TestServer {
  baseUrl: string;
  request: (method: string, path: string) => ReturnType<typeof fetch>;
  close: () => Promise<void>;
}

export const startServer = async (app: Application): Promise<TestServer> => {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    request: (method, path) => fetch(`${baseUrl}${path}`, { method: method.toUpperCase(), redirect: 'manual' }),
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
};
