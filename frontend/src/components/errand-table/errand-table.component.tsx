'use client';

import { ErrorAlertList } from '@components/misc/error-alert.component';
import { StatusLabel } from '@components/misc/status-label.component';
import { CenterDiv } from '@layouts/center-div.component';
import { Link, Spinner, Table } from '@sk-web-gui/react';
import { getTypeDisplayName } from '@utils/errand-helpers';
import dayjs from 'dayjs';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import { errandPath } from 'src/constants/services';
import { useOverviewErrands } from 'src/hooks/use-overview-errands';
import { useService } from 'src/hooks/use-service';
import { useSortStore } from 'src/stores/sort-store';

import { ErrandTableFooter } from './errand-table-footer.component';
import { ErrandTableHeader } from './errand-table-header.component';

export const ErrandTable: React.FC = () => {
  const { t } = useTranslation();
  const service = useService();
  const { rowHeight } = useSortStore();
  const { rows, isLoading, totalPages, errandsError, metadataError } = useOverviewErrands();

  const errors = [metadataError, errandsError].filter((message): message is string => message !== null);

  if (isLoading && rows.length === 0)
    return (
      <CenterDiv className="mt-[20rem]">
        <div role="status" aria-live="polite">
          <Spinner aria-hidden="true" />
          <span className="sr-only">{t('common:errand-table.loading')}</span>
        </div>
      </CenterDiv>
    );

  if (rows.length === 0 && errors.length === 0)
    return <CenterDiv className="mt-[20rem]">{t('errand-information:no_errands')}</CenterDiv>;

  return (
    <div className="flex flex-col gap-16 px-40">
      <ErrorAlertList messages={errors} />
      {rows.length > 0 && (
        <Table data-cy="errand-table" dense={rowHeight === 'dense'}>
          <ErrandTableHeader />

          <Table.Body>
            {rows.map((errand, index) => (
              <Table.Row key={`errand-row-${index}`}>
                <Table.Column>
                  <StatusLabel status={errand?.status} lifecycle={errand?.lifecycle} />
                </Table.Column>
                <Table.Column>
                  <Link
                    as={NextLink}
                    href={errandPath(service, errand.errandNumber)}
                    aria-label={t('common:errand-table.open_errand', { errandNumber: errand.errandNumber })}
                  >
                    {errand.errandNumber}
                  </Link>
                </Table.Column>
                <Table.Column>{getTypeDisplayName(errand)}</Table.Column>
                <Table.Column>{dayjs(errand.touched).format('YYYY-MM-DD HH:mm')}</Table.Column>
              </Table.Row>
            ))}
          </Table.Body>

          <Table.Footer>
            <ErrandTableFooter totalPages={totalPages} />
          </Table.Footer>
        </Table>
      )}
    </div>
  );
};
