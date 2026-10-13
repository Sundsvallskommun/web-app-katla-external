import { ErrandTable } from '@components/errand-table/errand-table.component';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { useOverviewErrands } from 'src/hooks/use-overview-errands';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import commonSv from '../../../locales/sv/common.json';

type ErrandTableData = Pick<ReturnType<typeof useOverviewErrands>, 'rows' | 'isLoading' | 'totalPages'>;

const useOverviewErrandsMock = vi.fn<() => ErrandTableData>();
const i18n = createInstance();

vi.mock('next/navigation', () => ({
  useParams: () => ({ service: 'alkoholtillstand' }),
}));

vi.mock('src/hooks/use-overview-errands', () => ({
  useOverviewErrands: () => useOverviewErrandsMock(),
}));

vi.mock('@components/errand-table/errand-table-footer.component', () => ({
  ErrandTableFooter: () => <div>Sidfot</div>,
}));

describe('ErrandTable', () => {
  beforeAll(async () => {
    await i18n.init({
      lng: 'sv',
      resources: { sv: { common: commonSv } },
      defaultNS: 'common',
      ns: ['common'],
    });
  });

  beforeEach(() => {
    useOverviewErrandsMock.mockReset();
  });

  it('renders valid table body markup and exposes navigation as a named link', () => {
    useOverviewErrandsMock.mockReturnValue({
      rows: [
        {
          errandNumber: 'AIA-25120019',
          status: 'NEW',
          touched: '2026-08-12T08:00:00Z',
          labels: [],
        },
      ],
      isLoading: false,
      totalPages: 1,
    });

    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <ErrandTable />
      </I18nextProvider>
    );

    const link = screen.getByRole('link', { name: 'Öppna ärende AIA-25120019' });
    expect(link).toHaveAttribute('href', '/alkoholtillstand/arende/AIA-25120019/grundinformation');
    expect(link.closest('tr')).not.toHaveAttribute('tabindex');
    expect(link.closest('tbody')).toBe(container.querySelector('table > tbody'));
  });

  it('announces the initial loading state', () => {
    useOverviewErrandsMock.mockReturnValue({ rows: [], isLoading: true, totalPages: 1 });

    render(
      <I18nextProvider i18n={i18n}>
        <ErrandTable />
      </I18nextProvider>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Laddar ärenden');
  });
});
