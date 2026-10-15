import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const generatorPath = resolve(process.cwd(), 'middleware-envs-generator.mjs');
const environmentKeys = [
  'NEXT_PUBLIC_PROTECTED_ROUTES',
  'ADMIN_URL',
  'NEXT_PUBLIC_BASE_PATH',
  'NEXT_PUBLIC_API_URL',
  'API_URL_INTERNAL',
] as const;

describe('middleware environment generation', () => {
  let workingDirectory: string;

  beforeEach(async () => {
    workingDirectory = await mkdtemp(join(tmpdir(), 'middleware-envs-'));
  });

  afterEach(async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  });

  const runGenerator = async () => {
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !environmentKeys.some((environmentKey) => environmentKey === key))
    );

    execFileSync(process.execPath, [generatorPath], {
      cwd: workingDirectory,
      env: environment,
    });

    return readFile(join(workingDirectory, 'middleware-envs.js'), 'utf8');
  };

  it('prefers .env.local values over .env values', async () => {
    await writeFile(
      join(workingDirectory, '.env'),
      [
        'NEXT_PUBLIC_PROTECTED_ROUTES=/fallback',
        'ADMIN_URL=https://fallback.example.com',
        'NEXT_PUBLIC_BASE_PATH=/fallback',
        'NEXT_PUBLIC_API_URL=https://fallback.example.com/api',
      ].join('\n')
    );
    await writeFile(
      join(workingDirectory, '.env.local'),
      [
        'NEXT_PUBLIC_PROTECTED_ROUTES=/local',
        'ADMIN_URL=https://local.example.com',
        'NEXT_PUBLIC_BASE_PATH=/local',
        'NEXT_PUBLIC_API_URL=https://local.example.com/api',
      ].join('\n')
    );

    await expect(runGenerator()).resolves.toBe(`export const envs = {
  protectedRoutes: '/local',
  adminUrl: 'https://local.example.com',
  basePath: '/local',
  apiUrl: 'https://local.example.com/api',
  sessionCookieName: 'connect.sid',
};\n`);
  });

  it('falls back to .env when .env.local is absent', async () => {
    await writeFile(
      join(workingDirectory, '.env'),
      [
        'NEXT_PUBLIC_PROTECTED_ROUTES=/fallback',
        'ADMIN_URL=https://fallback.example.com',
        'NEXT_PUBLIC_BASE_PATH=/fallback',
        'NEXT_PUBLIC_API_URL=https://fallback.example.com/api',
      ].join('\n')
    );

    await expect(runGenerator()).resolves.toContain("apiUrl: 'https://fallback.example.com/api'");
  });

  it('prefers API_URL_INTERNAL over NEXT_PUBLIC_API_URL for apiUrl', async () => {
    await writeFile(
      join(workingDirectory, '.env'),
      ['NEXT_PUBLIC_API_URL=https://public.example.com/api', 'API_URL_INTERNAL=http://localhost:3001/api'].join('\n')
    );

    await expect(runGenerator()).resolves.toContain("apiUrl: 'http://localhost:3001/api'");
  });
});
