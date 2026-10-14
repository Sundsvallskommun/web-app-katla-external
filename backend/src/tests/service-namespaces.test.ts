import { describe, expect, it } from 'vitest';

import { parseServiceNamespaces, serviceNamespaces } from '@/config/service-namespaces';

import { mockNamespace, mockServiceKey } from './helpers/mock-data';

describe('SERVICE_NAMESPACES', () => {
  it('maps each route prefix to its namespace', () => {
    expect([...parseServiceNamespaces(' alkoholtillstand = AOT , tobak=TOBAK,')]).toEqual([
      ['alkoholtillstand', 'AOT'],
      ['tobak', 'TOBAK'],
    ]);
  });

  it('is empty when unset', () => {
    expect(parseServiceNamespaces(undefined).size).toBe(0);
  });

  it('refuses an entry without a namespace', () => {
    expect(() => parseServiceNamespaces('alkoholtillstand')).toThrow(/key=NAMESPACE/);
    expect(() => parseServiceNamespaces('alkoholtillstand=')).toThrow(/key=NAMESPACE/);
  });

  it('resolves the configured test form and nothing else', () => {
    expect(serviceNamespaces.get(mockServiceKey)).toBe(mockNamespace);
    expect(serviceNamespaces.get('okand')).toBeUndefined();
  });
});
