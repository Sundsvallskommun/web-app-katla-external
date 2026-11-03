import { CancelErrandDialog } from '@components/cancel-errand-dialog.component';
import { CitizenContactDialog } from '@components/citizen-contact-dialog.component';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { Button, Dialog } from '@sk-web-gui/react';
import { appURL } from '@utils/app-url';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';
import { servicePath } from 'src/constants/services';
import { useSaveErrand } from 'src/hooks/use-save-errand';
import { useService } from 'src/hooks/use-service';

import { CenterDiv } from './center-div.component';

interface ErrandButtonGroupProps {
  isNewErrand: boolean;
}

export const ErrandButtonGroup: React.FC<ErrandButtonGroupProps> = ({ isNewErrand }) => {
  const { t } = useTranslation();
  const service = useService();
  const { watch } = useFormContext<ErrandFormDTO>();
  const { validate, saveDraft, register, citizenPrompt } = useSaveErrand();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCancelOpen, setIsCancelOpen] = useState<boolean>(false);

  const isDraft = watch('lifecycle') === 'DRAFT';
  const showButtons = isNewErrand || isDraft;
  const draftEnabled = appConfig.features.draftEnabled;

  const onSaveDraft = () => saveDraft({ navigate: isNewErrand });

  const onRegister = (logout?: boolean) => {
    setIsOpen(false);
    return register({ logout });
  };

  const onValidateBeforeRegister = async () => {
    if (await validate('register')) setIsOpen(true);
  };

  if (!showButtons) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-8 md:gap-[1.8rem]">
      {isNewErrand && (
        <Button
          variant="secondary"
          onClick={() => {
            setIsCancelOpen(true);
          }}
        >
          {t('errand-information:cancel')}
        </Button>
      )}
      {draftEnabled && (
        <Button
          data-cy="save-draft-errand"
          variant="primary"
          onClick={() => {
            void onSaveDraft();
          }}
        >
          {t('errand-information:save_draft')}
        </Button>
      )}
      <Button
        data-cy="register-errand"
        variant="primary"
        color="vattjom"
        onClick={() => {
          void onValidateBeforeRegister();
        }}
      >
        {t('errand-information:register')}
      </Button>
      <CancelErrandDialog
        show={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
        }}
        onConfirm={() => {
          window.location.assign(appURL(`${process.env.NEXT_PUBLIC_BASE_PATH}${servicePath(service)}`));
        }}
      />
      <CitizenContactDialog {...citizenPrompt} />
      <Dialog show={isOpen}>
        <Dialog.Content className="-mt-20">
          <CenterDiv>
            <Inbox size={32} className="mb-[1.6rem] text-vattjom-surface-primary" />
            <h3 className="text-h3-md">{t('errand-information:register')}</h3>
            <span className="text-dark-secondary text-md">{t('errand-information:submit_confirm.question')}</span>
          </CenterDiv>
        </Dialog.Content>

        <Dialog.Buttons className="justify-center flex-col sm:flex-row gap-8">
          <Button
            variant="secondary"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            {t('errand-information:submit_confirm.no')}
          </Button>
          <Button
            data-cy="submit-button"
            variant="primary"
            onClick={() => {
              void onRegister();
            }}
          >
            {t('errand-information:submit_confirm.submit')}
          </Button>
          <Button
            data-cy="submit-logout-button"
            variant="primary"
            color="vattjom"
            onClick={() => {
              void onRegister(true);
            }}
          >
            {t('errand-information:submit_confirm.submit_and_logout')}
          </Button>
        </Dialog.Buttons>
      </Dialog>
    </div>
  );
};
