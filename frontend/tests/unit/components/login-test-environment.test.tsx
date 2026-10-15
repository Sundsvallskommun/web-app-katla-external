import { LoginContent } from '@components/auth/login-content.component';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isProductionMock, routerPushMock } = vi.hoisted(() => ({
  isProductionMock: vi.fn<() => boolean>(),
  routerPushMock: vi.fn(),
}));

vi.mock('src/config/appconfig', () => ({ isProduction: isProductionMock }));

vi.mock('@components/loader/loader-fullscreen', () => ({ default: () => null }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams('failMessage=SAML_MISSING_CITIZEN_IDENTIFIER'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'sv' } }),
}));

describe('login page in a test environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names the refused login rather than reporting a generic failure', () => {
    isProductionMock.mockReturnValue(false);
    render(<LoginContent />);

    expect(screen.getByText('login:errors.SAML_MISSING_CITIZEN_IDENTIFIER')).toBeInTheDocument();
  });

  it('offers a logout so the next attempt can use another test user', () => {
    isProductionMock.mockReturnValue(false);
    // Selected on data-cy: testing-library resolves getByTestId against data-testid.
    const { container } = render(<LoginContent />);
    const logoutButton = container.querySelector('[data-cy="login-logout-button"]');

    expect(screen.getByText('login:test_environment_logout_help')).toBeInTheDocument();
    if (!logoutButton) throw new Error('Expected the test-environment logout button to render');
    fireEvent.click(logoutButton);

    expect(routerPushMock).toHaveBeenCalledWith('/logout');
  });

  it('keeps the logout out of production', () => {
    isProductionMock.mockReturnValue(true);
    const { container } = render(<LoginContent />);

    expect(container.querySelector('[data-cy="login-logout-button"]')).toBeNull();
    expect(screen.queryByText('login:test_environment_logout_help')).not.toBeInTheDocument();
  });
});
