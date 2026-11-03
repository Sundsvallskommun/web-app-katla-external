import { CenterDiv } from '@layouts/center-div.component';
import { Button, Dialog } from '@sk-web-gui/react';
import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CitizenContactDialogProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Tells the citizen they will be filed as contact person, since every errand must list them. */
export const CitizenContactDialog: React.FC<CitizenContactDialogProps> = ({ show, onClose, onConfirm }) => {
  const { t } = useTranslation();

  return (
    <Dialog show={show}>
      <Dialog.Content className="-mt-20">
        <CenterDiv className="max-w-[32rem] mx-auto">
          <UserRound size={32} className="mb-[1.6rem] text-vattjom-surface-primary" />
          <h3 className="text-h3-md mb-8">{t('errand-information:citizen_contact.title')}</h3>
          <span className="text-dark-secondary text-md text-center">
            {t('errand-information:citizen_contact.description')}
          </span>
        </CenterDiv>
      </Dialog.Content>
      <Dialog.Buttons className="justify-center">
        <Button data-cy="citizen-contact-cancel" variant="secondary" onClick={onClose}>
          {t('errand-information:citizen_contact.cancel')}
        </Button>
        <Button data-cy="citizen-contact-continue" variant="primary" onClick={onConfirm}>
          {t('errand-information:citizen_contact.continue')}
        </Button>
      </Dialog.Buttons>
    </Dialog>
  );
};
