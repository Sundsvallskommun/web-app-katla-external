import type { ErrandFormAttachment } from '@interfaces/errand-form';
import { uploadPendingAttachments } from '@services/errand-service/attachment-service';
import { useSnackbar } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';

/**
 * Sends the bilagor still only in the browser. Runs after the save — SupportManagement takes an
 * upload only for an errand that exists — and reports a failure rather than throwing it.
 */
export const useAttachmentUpload = (): ((
  errandId: string | undefined,
  attachments: ErrandFormAttachment[] | undefined
) => Promise<void>) => {
  const { t } = useTranslation();
  const toastMessage = useSnackbar();

  return async (errandId, attachments) => {
    if (!errandId) return;

    try {
      await uploadPendingAttachments(errandId, attachments);
    } catch {
      toastMessage({ position: 'bottom', status: 'error', message: t('errand-information:attachments.upload_error') });
    }
  };
};
