import { errandFormDataForSchemas, validateErrandFormData } from '@components/json/utils/schema-utils';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { validateErrandAttachments } from '@utils/errand-attachments';
import {
  PreconditionContext,
  validateCategorization,
  validateFormData,
  validateMunicipality,
  validateOwner,
  validateOwnerDetails,
} from '@utils/errand-preconditions';
import { validateErrandStops } from '@utils/schema-stops';

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
  if (step.kind === 'section') {
    // Only this section's questions: the later ones have not been shown yet.
    const { schemaName, fields } = step.section;
    const entries = errandFormDataForSchemas(formValues.errandFormData, [schemaName]);
    const formErrors = await validateErrandFormData(entries, tForms, locale, [schemaName], fields);
    return formErrors.length > 0 ? formErrors : validateErrandStops(formValues, t, locale, namespace, fields);
  }

  switch (step.id) {
    case 'about': {
      const missingMunicipality = validateMunicipality(formValues, t);
      return missingMunicipality.length > 0 ? missingMunicipality : validateCategorization(formValues, t);
    }
    case 'owner': {
      const missingOwner = validateOwner(formValues, t);
      return missingOwner.length > 0 ? missingOwner : validateOwnerDetails(formValues, t);
    }
    case 'details': {
      const formErrors = await validateFormData(formValues, 'register', tForms, locale, namespace);
      return formErrors.length > 0 ? formErrors : validateErrandStops(formValues, t, locale, namespace);
    }
    case 'attachments':
      return validateErrandAttachments(formValues, t, locale, namespace);
    default:
      return [];
  }
}
