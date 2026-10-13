import { render, screen } from '@testing-library/react';
import { ErrandTable } from 'src/components/errand-table/errand-table.component';
import { MobileErrandsList } from 'src/components/mobile/mobile-errands-list.component';
import { MobileStatusTabs } from 'src/components/mobile/mobile-status-tabs.component';
import { FilterOverviewSidebarStatusSelector } from 'src/components/sidebars/filter-overview-sidebar-status-selector.component';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ service: 'alkoholtillstand' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('src/hooks/use-overview-errands', () => ({
  useOverviewErrands: () => ({
    rows: [],
    isLoading: false,
    totalPages: 1,
    errandsError: 'api_errors.errands',
    metadataError: null,
  }),
}));

vi.mock('src/hooks/use-status-buttons', () => ({
  useStatusButtons: () => ({
    statusButtons: [],
    activeStatus: null,
    onSelectStatus: vi.fn(),
    isLoading: false,
    error: 'api_errors.counts',
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('API error presenters', () => {
  it('replaces the desktop false-empty state with an error alert', () => {
    render(<ErrandTable />);

    expect(screen.getByRole('alert')).toHaveTextContent('api_errors.errands');
    expect(screen.queryByText('errand-information:no_errands')).not.toBeInTheDocument();
  });

  it('replaces the mobile false-empty state with an error alert', () => {
    render(
      <MobileErrandsList
        rows={[]}
        isLoading={false}
        hasMore={false}
        loadMore={vi.fn()}
        errors={['api_errors.errands']}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('api_errors.errands');
    expect(screen.queryByText('errand-information:no_errands')).not.toBeInTheDocument();
  });

  it('shows count errors in the mobile and expanded desktop selectors', () => {
    const { unmount } = render(<MobileStatusTabs />);
    expect(screen.getByRole('alert')).toHaveTextContent('api_errors.counts');
    unmount();

    render(<FilterOverviewSidebarStatusSelector smallSideBar={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('api_errors.counts');
  });

  it('keeps a visible and accessible error indicator in the collapsed desktop selector', () => {
    render(<FilterOverviewSidebarStatusSelector smallSideBar />);

    expect(screen.getByRole('alert')).toHaveAttribute('title', 'api_errors.counts');
    expect(screen.getByRole('alert')).toHaveTextContent('api_errors.counts');
  });
});
