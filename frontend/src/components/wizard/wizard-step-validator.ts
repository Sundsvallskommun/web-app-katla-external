import { ErrandFormDTO } from '@interfaces/errand-form';
import { validateErrandAttachments } from '@utils/errand-attachments';
import {
  PreconditionContext,
  validateCategorization,
  validateFormData,
  validateOwner,
} from '@utils/errand-preconditions';

import { WizardStep } from './wizard-steps';

/**
 * Each step checks the same rule registration checks for its part of the errand, so what passes
 * the steps passes the final submit. The context is required: with a Swedish fallback a forgotten
 * wire-up would give Swedish validation errors in an English interface without the type checker
 * or a test reacting.
 */
export async function validateStep(
  step: WizardStep,
  formValues: ErrandFormDTO,
  { t, tForms, locale, namespace }: PreconditionContext
): Promise<string[]> {
  switch (step.id) {
    case 'about':
      return validateCategorization(formValues, t);
    case 'owner':
      return validateOwner(formValues, t);
    case 'details':
      return validateFormData(formValues, 'register', tForms, locale, namespace);
    case 'attachments':
      return validateErrandAttachments(formValues, t, locale, namespace);
    default:
      return [];
  }
}
