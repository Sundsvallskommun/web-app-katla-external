import { errandPath, isServiceKey, serviceKeyFromPath, servicePath } from 'src/constants/services';
import { describe, expect, it } from 'vitest';

describe('services', () => {
  it('recognises only registered forms', () => {
    expect(isServiceKey('alkoholtillstand')).toBe(true);
    expect(isServiceKey('oversikt')).toBe(false);
    expect(isServiceKey(undefined)).toBe(false);
  });

  it('builds the pages of a form from its key', () => {
    expect(servicePath('alkoholtillstand')).toBe('/alkoholtillstand');
    expect(errandPath('alkoholtillstand', 'AIA-25120019')).toBe(
      '/alkoholtillstand/arende/AIA-25120019/grundinformation'
    );
  });

  it('reads the form from the first path segment', () => {
    expect(serviceKeyFromPath('/alkoholtillstand')).toBe('alkoholtillstand');
    expect(serviceKeyFromPath('/alkoholtillstand/arende/AIA-25120019/grundinformation')).toBe('alkoholtillstand');
    expect(serviceKeyFromPath('/login')).toBeUndefined();
    expect(serviceKeyFromPath('/')).toBeUndefined();
  });
});
