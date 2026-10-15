import { StartContent } from '@components/start/start-content.component';
import { render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('start page', () => {
  it('links the alcohol and tobacco service to its public entry', () => {
    render(<StartContent />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('start:title');
    expect(screen.getByRole('link', { name: 'start:services.alkoholtillstand.title' })).toHaveAttribute(
      'href',
      '/alkoholtillstand'
    );
  });
});
