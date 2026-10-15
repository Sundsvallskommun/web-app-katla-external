import {
  errandFormDataForSchemas,
  schemaNamesForErrand,
  validateErrandFormData,
} from '@components/json/utils/schema-utils';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { validateErrandAttachments } from '@utils/errand-attachments';
import { getSelectedLabels } from '@utils/label-tree';
import { validateErrandStops } from '@utils/schema-stops';
import { getPrimaryStakeholder } from '@utils/stakeholder';
import type { TFunction } from 'i18next';

/** What the errand is about to be saved as. A draft is held to fewer rules than a registration. */
export type SaveIntent = 'draft' | 'register';

export interface PreconditionContext {
  t: TFunction;
  /** The forms namespace, where the JSON Schema error texts live. */
  tForms: TFunction;
  locale: string;
  namespace: string | undefined;
}

export const validateCategorization = (values: ErrandFormDTO, t: TFunction): string[] => {
  const { CATEGORY, TYPE } = getSelectedLabels(values.labels);
  if (!CATEGORY) return [t('validation:categorization.category_required')];
  return TYPE ? [] : [t('validation:categorization.type_required')];
};

// Without an owner the errand falls outside every organisation the session scopes by, so the
// citizen who filed it could not read it back.
export const validateOwner = (values: ErrandFormDTO, t: TFunction): string[] =>
  getPrimaryStakeholder(values.stakeholders) ? [] : [t('validation:owner.required')];

/**
 * Upstream validates the filed answers against their schema, so an invalid form is shown here
 * rather than answered with 400. A registration needs every schema of the ärendetyp filled in;
 * a draft is checked only on the forms that have been opened.
 */
export const validateFormData = (
  values: ErrandFormDTO,
  intent: SaveIntent,
  tForms: TFunction,
  locale: string,
  namespace: string | undefined
): Promise<string[]> => {
  const schemaNames = schemaNamesForErrand(values.labels, namespace);
  const filed = errandFormDataForSchemas(values.errandFormData, schemaNames);
  const required = intent === 'register' ? schemaNames : filed.map((entry) => entry.schemaName);

  return validateErrandFormData(filed, tForms, locale, required);
};

/** The rules a save must pass, in the order they are reported. Stops at the first rule that fails. */
export async function validateErrandForSave(
  values: ErrandFormDTO,
  intent: SaveIntent,
  { t, tForms, locale, namespace }: PreconditionContext
): Promise<string[]> {
  const rules: (() => string[] | Promise<string[]>)[] =
    intent === 'register' ?
      [
        () => validateCategorization(values, t),
        () => validateOwner(values, t),
        () => validateFormData(values, intent, tForms, locale, namespace),
        () => validateErrandStops(values, t, locale, namespace),
        () => validateErrandAttachments(values, t, locale, namespace),
      ]
    : [() => validateOwner(values, t), () => validateFormData(values, intent, tForms, locale, namespace)];

  for (const rule of rules) {
    const errors = await rule();
    if (errors.length > 0) return errors;
  }

  return [];
}
