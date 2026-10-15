import { matchesSchemaCondition, type SchemaCondition } from '@components/json/utils/schema-conditions';
import {
  isJsonObject,
  loadFormSchema,
  parseErrandFormData,
  schemaNamesForErrand,
  SchemaNotFoundError,
} from '@components/json/utils/schema-utils';
import type { ErrandFormAttachment, ErrandFormDTO } from '@interfaces/errand-form';
import type { RJSFSchema } from '@rjsf/utils';
import type { TFunction } from 'i18next';

/**
 * The bilagor an errand type asks for, declared by its schema under `x-attachments`.
 *
 * The jsonschema service takes no file uploads, so these are not properties — the files go to
 * SupportManagement — but which bilagor a type needs, and when, is still the schema's to say. The
 * app therefore learns them at runtime along with the rest of the schema and keeps no list of its
 * own. A schema without the block simply asks for no particular bilaga.
 */
export interface AttachmentType {
  key: string;
  label: string;
  description?: string;
  /** The rule that made the file field required, in the schema's own condition vocabulary. */
  requiredWhen?: SchemaCondition;
}

const ATTACHMENTS_KEYWORD = 'x-attachments';

const isAttachmentType = (value: unknown): value is AttachmentType =>
  isJsonObject(value) && typeof value.key === 'string' && typeof value.label === 'string';

/**
 * Entries that do not carry at least a key and a label are skipped rather than failing the form:
 * the schema is maintained in another system and reaches the citizen with no build step in
 * between, so a malformed entry must not take the whole Bilagor section down with it.
 */
export const attachmentTypesOfSchema = (schema: RJSFSchema | null | undefined): AttachmentType[] => {
  const declared: unknown = schema?.[ATTACHMENTS_KEYWORD];
  return Array.isArray(declared) ? (declared as unknown[]).filter(isAttachmentType) : [];
};

/** The answers the errand type's own form holds, which the requiredWhen conditions are read against. */
export const answersOfErrand = (values: ErrandFormDTO, schemaName: string): Record<string, unknown> => {
  const entry = values.errandFormData?.find((candidate) => candidate.schemaName === schemaName);
  if (!entry) return {};

  const parsed = parseErrandFormData(entry.data, schemaName);
  return parsed.valid && isJsonObject(parsed.value) ? parsed.value : {};
};

export const requiredAttachmentTypes = (
  types: readonly AttachmentType[],
  answers: Record<string, unknown>
): AttachmentType[] => types.filter((type) => type.requiredWhen && matchesSchemaCondition(type.requiredWhen, answers));

const hasAttachmentOfType = (attachments: ErrandFormAttachment[] | undefined, key: string): boolean =>
  (attachments ?? []).some((attachment) => attachment.category === key);

export const missingRequiredAttachments = (
  types: readonly AttachmentType[],
  answers: Record<string, unknown>,
  attachments: ErrandFormAttachment[] | undefined
): AttachmentType[] =>
  requiredAttachmentTypes(types, answers).filter((type) => !hasAttachmentOfType(attachments, type.key));

/**
 * Validates against the published schema rather than anything held here, so an errand type whose
 * bilagor changed upstream is judged by the new rule without an app release. An errand type with
 * no schema has no bilagor to demand.
 */
export async function validateErrandAttachments(
  values: ErrandFormDTO,
  t: TFunction,
  locale: string | undefined,
  namespace: string | undefined
): Promise<string[]> {
  for (const schemaName of schemaNamesForErrand(values.labels, namespace)) {
    let schema: RJSFSchema;
    try {
      ({ schema } = await loadFormSchema(schemaName, t, locale));
    } catch (error) {
      // With the schema unread the requirement is unknown, so fail closed.
      if (error instanceof SchemaNotFoundError) continue;
      return [t('validation:attachments.check_failed')];
    }

    const missing = missingRequiredAttachments(
      attachmentTypesOfSchema(schema),
      answersOfErrand(values, schemaName),
      values.attachments
    );
    if (missing.length === 1) return [t('validation:attachments.required', { label: missing[0].label })];
    if (missing.length > 1) {
      const labels = missing.map((type) => `"${type.label}"`).join(', ');
      return [t('validation:attachments.required_several', { labels })];
    }
  }

  return [];
}
