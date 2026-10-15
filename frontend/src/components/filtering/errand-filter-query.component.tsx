import { SearchField } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';

export const ErrandFilterQuery: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SearchField
      value={''}
      size="md"
      data-cy="query-filter"
      showSearchButton={true}
      className="flex-grow max-w-full"
      placeholder={t('filtering:search')}
      onChange={() => {
        // Deliberately empty: the field is not wired to any filtering yet.
      }}
    />
  );
};
