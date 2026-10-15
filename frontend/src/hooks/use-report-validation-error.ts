'use client';

import { useFormValidation } from '@contexts/form-validation-context';
import { useSnackbar } from '@sk-web-gui/react';

/** The message says what is missing, the fields show it and focus moves there, so it can be fixed at once. */
export const useReportValidationError = () => {
  const toastMessage = useSnackbar();
  const { setShowValidation, focusFirstError } = useFormValidation();

  return (message: string) => {
    setShowValidation(true);
    toastMessage({ position: 'bottom', status: 'error', message });
    focusFirstError();
  };
};
