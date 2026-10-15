import { describe, expect, it, vi } from 'vitest';

const loadConfig = async (value: string | undefined) => {
  vi.resetModules();
  if (value === undefined) {
    vi.stubEnv('NEXT_PUBLIC_ENVIRONMENT', '');
  } else {
    vi.stubEnv('NEXT_PUBLIC_ENVIRONMENT', value);
  }
  return import('src/config/appconfig');
};

describe('environment', () => {
  it('reads the deploy environments the app knows about', async () => {
    expect((await loadConfig('LOCAL')).appConfig.environment).toBe('LOCAL');
    expect((await loadConfig('TEST')).appConfig.environment).toBe('TEST');
    expect((await loadConfig(' test ')).appConfig.environment).toBe('TEST');
  });

  it('treats an unset or unknown value as production, so test affordances stay off by default', async () => {
    expect((await loadConfig(undefined)).appConfig.environment).toBe('PRODUCTION');
    expect((await loadConfig('')).appConfig.environment).toBe('PRODUCTION');
    expect((await loadConfig('sandbox')).appConfig.environment).toBe('PRODUCTION');
  });

  it('reports production for anything that is not LOCAL or TEST', async () => {
    expect((await loadConfig('')).isProduction()).toBe(true);
    expect((await loadConfig('TEST')).isProduction()).toBe(false);
    expect((await loadConfig('LOCAL')).isProduction()).toBe(false);
  });
});
