import i18nConfig from '@app/i18nConfig';
import { CancelErrandDialog } from '@components/cancel-errand-dialog.component';
import { CitizenContactDialog } from '@components/citizen-contact-dialog.component';
import { useFormValidation } from '@contexts/form-validation-context';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { CenterDiv } from '@layouts/center-div.component';
import { Button, Dialog } from '@sk-web-gui/react';
import { appURL } from '@utils/app-url';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';
import { MOBILE_BREAKPOINT } from 'src/constants/responsive';
import { servicePath } from 'src/constants/services';
import { useMediaQuery } from 'src/hooks/use-media-query';
import { useReportValidationError } from 'src/hooks/use-report-validation-error';
import { useSaveErrand } from 'src/hooks/use-save-errand';
import { useService } from 'src/hooks/use-service';
import { useMetadataStore } from 'src/stores/metadata-store';
import { useWizardStore } from 'src/stores/wizard-store';

import { validateStep } from './wizard-step-validator';
import { useWizardSteps } from './wizard-steps-context';

export const WizardBottomBar: React.FC = () => {
  const { t } = useTranslation();
  const service = useService();
  const { t: tForms, i18n } = useTranslation('forms');
  const locale = i18n.resolvedLanguage ?? i18nConfig.defaultLocale;
  const { getValues, watch } = useFormContext<ErrandFormDTO>();
  const { setShowValidation } = useFormValidation();
  const reportValidationError = useReportValidationError();
  const { validate, saveDraft, register, citizenPrompt } = useSaveErrand();
  const setStepErrors = useWizardStore((s) => s.setStepErrors);
  const { step, isFirst: isFirstStep, isLast: isLastStep, goNext, goBack } = useWizardSteps();
  const [isOpen, setIsOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const namespace = useMetadataStore((state) => state.metadata?.namespace);
  const draftEnabled = appConfig.features.draftEnabled;
  const isNewErrand = !watch('id');
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const buttonClass = isMobile ? 'flex-1' : undefined;
  const buttonSize = isMobile ? 'sm' : 'md';

  const onSaveDraft = () => saveDraft({ navigate: isNewErrand });

  const onRegister = (logout?: boolean) => {
    setIsOpen(false);
    return register({ logout });
  };

  const handleNext = async () => {
    const errors = await validateStep(step, getValues(), { t, tForms, locale, namespace });
    setStepErrors(step.id, errors);

    if (errors.length > 0) {
      reportValidationError(errors[0]);
      return;
    }

    setShowValidation(false);
    goNext();
  };

  const handleSubmit = async () => {
    if (await validate('register')) setIsOpen(true);
  };

  const backButton = !isFirstStep && (
    <Button
      data-cy="wizard-back"
      size={buttonSize}
      variant="tertiary"
      leftIcon={<ChevronLeft size={18} />}
      onClick={() => {
        setShowValidation(false);
        goBack();
      }}
      className={buttonClass}
    >
      {t('errand-information:wizard.back')}
    </Button>
  );

  const actions = (
    <>
      {isNewErrand && (
        <Button
          size={buttonSize}
          variant="secondary"
          onClick={() => {
            setIsCancelOpen(true);
          }}
          className={buttonClass}
        >
          {t('errand-information:wizard.cancel')}
        </Button>
      )}
      {draftEnabled && (
        <Button
          data-cy="save-draft-errand"
          size={buttonSize}
          variant="primary"
          onClick={() => {
            void onSaveDraft();
          }}
          className={buttonClass}
        >
          {isMobile ? t('errand-information:wizard.save') : t('errand-information:save_draft')}
        </Button>
      )}
      {isLastStep ?
        <Button
          data-cy="register-errand"
          size={buttonSize}
          variant="primary"
          color="vattjom"
          onClick={() => {
            void handleSubmit();
          }}
          className={buttonClass}
        >
          {t('errand-information:register')}
        </Button>
      : <Button
          data-cy="wizard-next"
          size={buttonSize}
          variant="primary"
          color="vattjom"
          rightIcon={<ChevronRight size={18} />}
          onClick={() => {
            void handleNext();
          }}
          className={buttonClass}
        >
          {t('errand-information:wizard.next')}
        </Button>
      }
    </>
  );

  return (
    <>
      <div className="px-16 py-12 bg-background-content border-t-1 border-divider">
        {isMobile ?
          <div className="flex items-center justify-center gap-12">
            {backButton}
            {actions}
          </div>
        : <div className="mx-auto max-w-[108rem] flex items-center justify-between gap-12">
            <div>{backButton}</div>
            <div className="flex items-center gap-12">{actions}</div>
          </div>
        }
      </div>

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
    </>
  );
};
