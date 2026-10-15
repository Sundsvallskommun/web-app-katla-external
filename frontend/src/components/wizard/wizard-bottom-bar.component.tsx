import i18nConfig from '@app/i18nConfig';
import { CancelErrandDialog } from '@components/cancel-errand-dialog.component';
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
import { servicePath } from 'src/constants/services';
import { useActiveWizardSteps } from 'src/hooks/use-active-wizard-steps';
import { useReportValidationError } from 'src/hooks/use-report-validation-error';
import { useSaveErrand } from 'src/hooks/use-save-errand';
import { useService } from 'src/hooks/use-service';
import { useMetadataStore } from 'src/stores/metadata-store';
import { useWizardStore } from 'src/stores/wizard-store';

import { validateStep } from './wizard-step-validator';

export const WizardBottomBar: React.FC = () => {
  const { t } = useTranslation();
  const service = useService();
  const { t: tForms, i18n } = useTranslation('forms');
  const locale = i18n.resolvedLanguage ?? i18nConfig.defaultLocale;
  const { getValues } = useFormContext<ErrandFormDTO>();
  const { setShowValidation } = useFormValidation();
  const reportValidationError = useReportValidationError();
  const { validate, saveDraft, register } = useSaveErrand();
  const { currentStep, goNext, goBack, setStepErrors } = useWizardStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const namespace = useMetadataStore((state) => state.metadata?.namespace);
  const steps = useActiveWizardSteps();
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const draftEnabled = appConfig.features.draftEnabled;

  // The wizard only registers new errands, so a saved draft is always opened.
  const onSaveDraft = () => saveDraft({ navigate: true });

  const onRegister = (logout?: boolean) => {
    setIsOpen(false);
    return register({ logout });
  };

  const handleNext = async () => {
    const step = steps[currentStep];
    const errors = await validateStep(step, getValues(), { t, tForms, locale, namespace });
    setStepErrors(currentStep, errors);

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

  return (
    <>
      <div className="flex items-center justify-center px-16 py-12 bg-background-content border-t-1 border-divider gap-12">
        {!isFirstStep && (
          <Button
            size="sm"
            variant="tertiary"
            leftIcon={<ChevronLeft size={18} />}
            onClick={() => {
              setShowValidation(false);
              goBack();
            }}
            className="flex-1"
          >
            {t('errand-information:wizard.back')}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setIsCancelOpen(true);
          }}
          className="flex-1"
        >
          {t('errand-information:wizard.cancel')}
        </Button>
        {draftEnabled && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              void onSaveDraft();
            }}
            className="flex-1"
          >
            {t('errand-information:wizard.save')}
          </Button>
        )}
        {isLastStep ?
          <Button
            size="sm"
            variant="primary"
            color="vattjom"
            onClick={() => {
              void handleSubmit();
            }}
            className="flex-1"
          >
            {t('errand-information:wizard.submit')}
          </Button>
        : <Button
            size="sm"
            variant="primary"
            color="vattjom"
            rightIcon={<ChevronRight size={18} />}
            onClick={() => {
              void handleNext();
            }}
            className="flex-1"
          >
            {t('errand-information:wizard.next')}
          </Button>
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
