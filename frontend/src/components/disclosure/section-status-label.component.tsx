import { Label } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';

/**
 * Sections only get a status once validation is running. Before that the form cannot tell an
 * empty field that is an error from one the user has simply not reached yet.
 */
export type SectionStatus = 'error' | 'complete';

export const SectionStatusLabel: React.FC<{ status: SectionStatus; 'data-cy'?: string }> = ({
  status,
  'data-cy': dataCy,
}) => {
  const { t } = useTranslation('forms');

  return (
    <Label
      inverted
      rounded
      color={status === 'error' ? 'error' : 'gronsta'}
      className="sk-disclosure-label whitespace-nowrap"
      data-cy={dataCy}
    >
      {t(status === 'error' ? 'section_incomplete' : 'section_complete')}
    </Label>
  );
};
