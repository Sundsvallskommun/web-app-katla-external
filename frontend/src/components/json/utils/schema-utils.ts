import i18nConfig from '@app/i18nConfig';
import type { ErrandLabelDTO, JsonParameterDTO } from '@data-contracts/backend/data-contracts';
import type { ErrandFormDataItem } from '@interfaces/errand-form';
import type { RJSFSchema, RJSFValidationError, UiSchema } from '@rjsf/utils';
import { getSelectedLabels } from '@utils/label-tree';
import type { TFunction } from 'i18next';

import { getJsonValueSchemaValidator } from '../schema/form-schema-validator';
import { createJsonErrorTransformer, fieldTitleFromSchema } from './schema-form-error-handling';

/**
 * Ärendeuppgifter is one schema per errand type, named after the app's SupportManagement namespace
 * followed by the errand's whole categorization path, lower case: an AOT errand classified
 * ALCOHOL / SERVING_PERMIT_APPLICATION / PERMANENT_SERVING is filled in with
 * `aot_alcohol_serving_permit_application_permanent_serving`.
 *
 * Both halves earn their place. The jsonschema service partitions only by municipality, so every
 * app in the kommun shares one flat name space and the namespace is the sole collision boundary.
 * The full path rather than the leaf because a leaf name is only unique under its own parent —
 * STADIGVARANDE sits under both ALKOHOL and TOBACCO in the label tree today.
 *
 * The generator names the schemas the same way, so neither side needs a lookup table.
 *
 * An errand type with no schema — tillsyn, or a type whose flow has not been migrated — has no
 * form, which is why this returns a list rather than a name.
 */
export const schemaNamesForErrand = (
  labels: ErrandLabelDTO[] | undefined,
  namespace: string | undefined
): readonly string[] => {
  const { CATEGORY, TYPE, SUBTYPE } = getSelectedLabels(labels);
  const path = [CATEGORY, TYPE, SUBTYPE]
    .map((label) => label?.resourceName)
    .filter((resourceName): resourceName is string => !!resourceName);

  // A CATEGORY on its own is not an errand type, so it selects no schema.
  if (!namespace || path.length < 2) return [];

  return [[namespace, ...path].join('_').toLowerCase()];
};

/**
 * The jsonschema service has no schema by that name. For an errand type whose flow has not been
 * migrated that is the normal answer, not a failure: it means the type has no form yet.
 */
export class SchemaNotFoundError extends Error {
  constructor(readonly schemaName: string) {
    super(`No schema named ${schemaName}`);
    this.name = 'SchemaNotFoundError';
  }
}

export type ErrandFormDataContractErrorCode = 'invalid-json' | 'missing-schema-id' | 'missing-schema-name';

export class ErrandFormDataContractError extends Error {
  constructor(
    readonly code: ErrandFormDataContractErrorCode,
    readonly schemaName: string
  ) {
    super(`${code}: ${schemaName || 'unknown schema'}`);
    this.name = 'ErrandFormDataContractError';
  }
}

export type ParsedErrandFormData =
  { valid: true; value: unknown } | { valid: false; error: ErrandFormDataContractError };

export function parseErrandFormData(rawData: string, schemaName: string): ParsedErrandFormData {
  try {
    const value: unknown = JSON.parse(rawData);
    return { valid: true, value };
  } catch {
    return { valid: false, error: new ErrandFormDataContractError('invalid-json', schemaName) };
  }
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function errandFormDataContractErrorMessage(error: unknown, t?: TFunction): string | undefined {
  if (!(error instanceof ErrandFormDataContractError)) return undefined;

  const translationKey: Record<ErrandFormDataContractErrorCode, string> = {
    'invalid-json': 'invalid_form_data',
    'missing-schema-id': 'missing_schema_id',
    'missing-schema-name': 'missing_schema_name',
  };
  const fallback: Record<ErrandFormDataContractErrorCode, string> = {
    'invalid-json': `Invalid JSON data for ${error.schemaName}`,
    'missing-schema-id': `Missing schema ID for ${error.schemaName}`,
    'missing-schema-name': 'Missing schema name for JSON data',
  };

  return t ? t(translationKey[error.code], { schemaName: error.schemaName }) : fallback[error.code];
}

function requireSchemaId(schemaId: unknown, schemaName: string): string {
  if (typeof schemaId !== 'string' || schemaId.trim().length === 0) {
    throw new ErrandFormDataContractError('missing-schema-id', schemaName);
  }
  return schemaId;
}

// Cache the schema to avoid repeated fetches. The key carries the language because the same
// schema can be delivered with different field labels per language — without it the first
// language fetched would be served to every later reader.
const schemaCache = new Map<
  string,
  { schema: RJSFSchema; uiSchema?: UiSchema<Record<string, unknown>>; schemaId: string }
>();

const cacheKey = (locale: string, id: string): string => `${locale}:${id}`;

/**
 * The jsonschema API owns the schema's field labels, not the frontend. The language is sent
 * with the request rather than translated here: a translation table in the frontend would
 * duplicate content versioned in another system and drift silently at every new schema version.
 * For now the API answers in Swedish whatever language is asked for.
 */
const localeHeaders = (locale: string): HeadersInit => ({ 'Accept-Language': locale });

export function enumTitleOf(schema: RJSFSchema | null, field: string, value: string): string {
  if (!schema || !value) return value ?? '';
  const schemaRecord = schema as Record<string, unknown>;
  const properties = schemaRecord.properties as Record<string, unknown> | undefined;
  const fieldSchema = properties?.[field] as Record<string, unknown> | undefined;
  const oneOf = fieldSchema?.oneOf as { const: string; title?: string }[] | undefined;
  return oneOf?.find((o) => o.const === value)?.title ?? value;
}

export function enumTitlesOfArray(schema: RJSFSchema | null, field: string, values: string[] = []): string[] {
  if (!schema) return values ?? [];
  const schemaRecord = schema as Record<string, unknown>;
  const properties = schemaRecord.properties as Record<string, unknown> | undefined;
  const fieldSchema = properties?.[field] as Record<string, unknown> | undefined;
  const items = fieldSchema?.items as Record<string, unknown> | undefined;
  const oneOf = items?.oneOf as { const: string; title?: string }[] | undefined;
  if (!oneOf) return values ?? [];
  return (values ?? []).map((v) => oneOf.find((o) => o.const === v)?.title ?? v);
}

export async function loadFormSchema(
  schemaName: string,
  t?: TFunction,
  locale = i18nConfig.defaultLocale
): Promise<{
  schema: RJSFSchema;
  uiSchema?: UiSchema<Record<string, unknown>>;
  schemaId: string;
}> {
  const cached = schemaCache.get(cacheKey(locale, schemaName));
  if (cached) {
    return cached;
  }

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '') || '/api';

  try {
    const response = await fetch(`${apiUrl}/schemas/latest/${schemaName}`, {
      credentials: 'include',
      headers: localeHeaders(locale),
    });
    if (response.status === 404) {
      throw new SchemaNotFoundError(schemaName);
    }
    if (!response.ok) {
      throw new Error(`Failed to load schema: ${response.statusText}`);
    }
    const {
      schema,
      uiSchema,
      schemaId: responseSchemaId,
    } = (await response.json()) as {
      schema: RJSFSchema;
      uiSchema?: UiSchema<Record<string, unknown>>;
      schemaId?: unknown;
    };

    if (!isJsonObject(schema)) {
      throw new Error(`Schema definition is missing: ${schemaName}`);
    }
    const schemaId = requireSchemaId(responseSchemaId, schemaName);

    // Store the exact version under both its logical name and its immutable ID.
    const result = { schema, uiSchema, schemaId };
    schemaCache.set(cacheKey(locale, schemaName), result);
    schemaCache.set(cacheKey(locale, schemaId), result);

    return result;
  } catch (error) {
    if (error instanceof SchemaNotFoundError) throw error;
    console.error(`Failed to load schema: ${schemaName}`, error);
    if (error instanceof ErrandFormDataContractError) throw error;
    const errorMessage = t ? t('schema_load_error', { schemaName }) : `Could not load schema: ${schemaName}`;
    throw new Error(errorMessage);
  }
}

export async function loadFormSchemaById(
  schemaId: string,
  t?: TFunction,
  locale = i18nConfig.defaultLocale
): Promise<{
  schema: RJSFSchema;
  uiSchema?: UiSchema<Record<string, unknown>>;
  schemaId: string;
}> {
  const exactSchemaId = requireSchemaId(schemaId, schemaId);
  const cached = schemaCache.get(cacheKey(locale, exactSchemaId));
  if (cached) {
    return { ...cached, schemaId: exactSchemaId };
  }

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '') || '/api';

  try {
    const response = await fetch(`${apiUrl}/schemas/${exactSchemaId}`, {
      credentials: 'include',
      headers: localeHeaders(locale),
    });
    if (!response.ok) {
      throw new Error(`Failed to load schema: ${response.statusText}`);
    }
    const {
      schema,
      uiSchema,
      schemaId: responseSchemaId,
    } = (await response.json()) as {
      schema: RJSFSchema;
      uiSchema?: UiSchema<Record<string, unknown>>;
      schemaId?: unknown;
    };

    if (!isJsonObject(schema)) {
      throw new Error(`Schema definition is missing: ${exactSchemaId}`);
    }
    const verifiedSchemaId = requireSchemaId(responseSchemaId, exactSchemaId);
    if (verifiedSchemaId !== exactSchemaId) {
      throw new Error(`Schema ID does not match request: ${exactSchemaId}`);
    }

    const result = { schema, uiSchema, schemaId: verifiedSchemaId };
    schemaCache.set(cacheKey(locale, exactSchemaId), result);

    return result;
  } catch (error) {
    console.error(`Failed to load schema by ID: ${exactSchemaId}`, error);
    const errorMessage =
      t ? t('schema_load_error', { schemaName: exactSchemaId }) : `Could not load schema: ${exactSchemaId}`;
    throw new Error(errorMessage);
  }
}

export function loadFormSchemaForEntry(
  schemaName: string,
  schemaId?: string,
  t?: TFunction,
  locale = i18nConfig.defaultLocale
): Promise<{
  schema: RJSFSchema;
  uiSchema?: UiSchema<Record<string, unknown>>;
  schemaId: string;
}> {
  return loadFormSchemaById(requireSchemaId(schemaId, schemaName), t, locale);
}

function schemaValidationError(schemaName: string, t?: TFunction): string {
  return t ? t('schema_validation_error', { schemaName }) : `Could not validate ${schemaName}`;
}

// An entry is missing until the user touches the form. That is not a system error but something
// left to fill in, and the message has to say so to be actionable.
function requiredFormDataError(schemaName: string, t?: TFunction): string {
  return t ? t('required_form_data', { schemaName }) : `Fill in ${schemaName} before continuing`;
}

/**
 * AJV phrases its errors in English and names the field by its schema key. The summary shown to
 * the user therefore reuses the form's translated messages and field titles, so the error can be
 * tied to the field on screen.
 */
function schemaFieldValidationError(
  schema: RJSFSchema,
  schemaName: string,
  validationErrors: RJSFValidationError[],
  t?: TFunction
): string {
  const schemaTitle = schema.title ?? schemaName;
  const [firstError] = t ? createJsonErrorTransformer(schema, t)(validationErrors) : validationErrors;
  const message = firstError.message ?? '';
  const fieldTitle = fieldTitleFromSchema(schema, firstError.property);

  if (!t) {
    return fieldTitle ? `${schemaTitle} – ${fieldTitle}: ${message}` : `${schemaTitle}: ${message}`;
  }

  return fieldTitle ?
      t('form_field_error', { schemaTitle, fieldTitle, message })
    : t('form_error', { schemaTitle, message });
}

/**
 * Validates all errand form data against its schemas. Returns a list of error messages, empty
 * when everything is valid.
 * @param formDataEntries - The entries to validate
 * @param t - Optional translation function for error messages
 */
export async function validateErrandFormData(
  formDataEntries: ErrandFormDataItem[] | undefined,
  t?: TFunction,
  // Must follow the active language. Otherwise validation runs against the default-language
  // schema while the form renders in another, giving both an extra fetch and field titles in the
  // wrong language in the error summary.
  locale = i18nConfig.defaultLocale,
  // Injectable so the fail-closed rule can be covered even while the real list is empty.
  requiredSchemaNames: readonly string[] = []
): Promise<string[]> {
  const errors: string[] = [];
  const entries = errandFormDataForSchemas(formDataEntries, requiredSchemaNames);
  const missingSchemaNames = requiredSchemaNames.filter(
    (schemaName) => !entries.some((entry) => entry.schemaName === schemaName)
  );

  for (const schemaName of missingSchemaNames) {
    // An errand type whose flow has no schema has nothing to fill in, so it cannot be missing it.
    try {
      await loadFormSchema(schemaName, t, locale);
    } catch (error) {
      if (error instanceof SchemaNotFoundError) continue;
    }
    errors.push(requiredFormDataError(schemaName, t));
  }

  for (const entry of entries) {
    if (!entry.schemaName.trim()) {
      const contractError = new ErrandFormDataContractError('missing-schema-name', entry.schemaName);
      errors.push(errandFormDataContractErrorMessage(contractError, t) ?? schemaValidationError(entry.schemaName, t));
      continue;
    }

    const parsedData = parseErrandFormData(entry.data, entry.schemaName);
    if (!parsedData.valid) {
      errors.push(
        errandFormDataContractErrorMessage(parsedData.error, t) ?? schemaValidationError(entry.schemaName, t)
      );
      continue;
    }

    try {
      const { schema, schemaId } = await loadFormSchemaForEntry(entry.schemaName, entry.schemaId, t, locale);
      const validator = getJsonValueSchemaValidator(schemaId);
      const { errors: validationErrors } = validator.validateFormData(parsedData.value, schema);

      if (validationErrors.length > 0) {
        errors.push(schemaFieldValidationError(schema, entry.schemaName, validationErrors, t));
      }
    } catch (error: unknown) {
      errors.push(errandFormDataContractErrorMessage(error, t) ?? schemaValidationError(entry.schemaName, t));
    }
  }

  return errors;
}

export function upsertErrandFormDataItem(
  formDataEntries: ErrandFormDataItem[] | undefined,
  nextEntry: ErrandFormDataItem
): ErrandFormDataItem[] {
  const entries = formDataEntries ?? [];
  const existingIndex = entries.findIndex((entry) => entry.schemaName === nextEntry.schemaName);

  if (existingIndex === -1) {
    return [...entries, nextEntry];
  }

  const nextEntries = [...entries];
  nextEntries[existingIndex] = {
    ...entries[existingIndex],
    ...nextEntry,
    schemaId: entries[existingIndex].schemaId ?? nextEntry.schemaId,
  };
  return nextEntries;
}

/**
 * The entries the current errand type calls for. Changing ärendetyp leaves the previous type's
 * answers in form state — deliberately, so switching back does not lose them — but they must not be
 * validated or filed, or an alcohol errand carries a tobacco form's data and its required fields.
 */
export const errandFormDataForSchemas = (
  formData: ErrandFormDataItem[] | undefined,
  schemaNames: readonly string[]
): ErrandFormDataItem[] => (formData ?? []).filter((entry) => schemaNames.includes(entry.schemaName));

export function errandFormDataToJsonParameters(formData: ErrandFormDataItem[] | undefined): JsonParameterDTO[] {
  if (!formData) return [];
  return formData.map((entry) => {
    if (!entry.schemaName.trim()) {
      throw new ErrandFormDataContractError('missing-schema-name', entry.schemaName);
    }

    const schemaId = requireSchemaId(entry.schemaId, entry.schemaName);
    const parsedData = parseErrandFormData(entry.data, entry.schemaName);
    if (!parsedData.valid) throw parsedData.error;

    return {
      key: entry.schemaName,
      value: parsedData.value,
      schemaId,
    };
  });
}

export function jsonParametersToErrandFormData(jsonParameters: JsonParameterDTO[] | undefined): ErrandFormDataItem[] {
  if (!jsonParameters) return [];
  return jsonParameters.map((param) => ({
    schemaName: param.key,
    schemaId: param.schemaId,
    data: JSON.stringify(param.value === undefined ? {} : param.value),
  }));
}
