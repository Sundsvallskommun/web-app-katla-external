import { generateMetadata } from '@app/[locale]/[service]/(errand)/arende/[errandnumber]/grundinformation/page';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@components/errand-pages/created-errand.component', () => ({ CreatedErrand: () => null }));

describe('errand page metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['sv', 'Katla - Ärende: AOT-26100060'],
    ['en', 'Katla - Case: AOT-26100060'],
  ])('titles the page with the errand number in %s', async (locale, title) => {
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'Katla');

    await expect(
      generateMetadata({ params: Promise.resolve({ locale, errandnumber: 'AOT-26100060' }) })
    ).resolves.toEqual({ title });
  });
});
