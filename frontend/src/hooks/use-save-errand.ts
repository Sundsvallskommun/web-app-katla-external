'use client';

import i18nConfig from '@app/i18nConfig';
import {
  errandFormDataContractErrorMessage,
  jsonParametersToErrandFormData,
} from '@components/json/utils/schema-utils';
import { ErrandDTO } from '@data-contracts/backend/data-contracts';
import { ErrandFormDTO, ErrandLifecycle } from '@interfaces/errand-form';
import { createErrand, updateErrand } from '@services/errand-service/errand-service';
import { useSnackbar } from '@sk-web-gui/react';
import { SaveIntent, validateErrandForSave } from '@utils/errand-preconditions';
import { prepareErrandForApi } from '@utils/prepare-errand';
import { useRouter } from 'next/navigation';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { errandPath } from 'src/constants/services';
import { useAttachmentUpload } from 'src/hooks/use-attachment-upload';
import { useReportValidationError } from 'src/hooks/use-report-validation-error';
import { useService } from 'src/hooks/use-service';
import { useMetadataStore } from 'src/stores/metadata-store';

/**
 * Saving is the same sequence for the desktop button group and the wizard: check the
 * preconditions, prepare, create or update, send the pending bilagor, then reset the form to what
 * upstream answered. `saveDraft` validates on its own. Registration is confirmed in a dialog
 * first, so the surface calls `validate('register')` before opening it and `register` only saves.
 */
export const useSaveErrand = () => {
  const { t } = useTranslation();
  const service = useService();
  const { t: tForms, i18n } = useTranslation('forms');
  const locale = i18n.resolvedLanguage ?? i18nConfig.defaultLocale;
  const toastMessage = useSnackbar();
  const reportValidationError = useReportValidationError();
  const router = useRouter();
  const { getValues, reset, watch } = useFormContext<ErrandFormDTO>();
  const namespace = useMetadataStore((state) => state.metadata?.namespace);
  const uploadAttachments = useAttachmentUpload();
  const errandId = watch('id');

  const validate = async (intent: SaveIntent): Promise<boolean> => {
    const errors = await validateErrandForSave(getValues(), intent, { t, tForms, locale, namespace });
    if (errors.length === 0) return true;

    reportValidationError(errors[0]);
    return false;
  };

  const save = async (lifecycle: ErrandLifecycle, successMessage: string): Promise<ErrandDTO | undefined> => {
    try {
      const errandData = prepareErrandForApi(getValues(), lifecycle, namespace);
      const errand = await (errandId ? updateErrand(errandId, errandData) : createErrand(errandData));
      await uploadAttachments(errand.id, getValues('attachments'));
      const errandFormData = jsonParametersToErrandFormData(errand.jsonParameters);
      toastMessage({ position: 'bottom', status: 'success', message: successMessage });
      reset({ ...errand, errandFormData });
      return errand;
    } catch (error: unknown) {
      toastMessage({
        position: 'bottom',
        status: 'error',
        message: errandFormDataContractErrorMessage(error, tForms) ?? t('errand-information:save_message.error'),
      });
      return undefined;
    }
  };

  /** `navigate` opens the saved errand; a draft reopened from the list stays where it is. */
  const saveDraft = async ({ navigate }: { navigate: boolean }): Promise<void> => {
    if (!(await validate('draft'))) return;

    const errand = await save('DRAFT', t('errand-information:save_message.draft'));
    if (errand && navigate) router.push(errandPath(service, errand.errandNumber));
  };

  const register = async ({ logout = false }: { logout?: boolean } = {}): Promise<void> => {
    const errand = await save('ACTIVE', t('errand-information:save_message.register'));
    if (errand) router.push(logout ? '/logout' : errandPath(service, errand.errandNumber));
  };

  return { validate, saveDraft, register };
};
