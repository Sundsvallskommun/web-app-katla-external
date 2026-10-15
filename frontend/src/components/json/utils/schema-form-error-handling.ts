import type { RJSFSchema, RJSFValidationError } from '@rjsf/utils';
import type { TFunction } from 'i18next';

interface LimitParams {
  limit: number;
}
interface FormatParams {
  format: string;
}

const hasLimit = (e: RJSFValidationError): e is Omit<RJSFValidationError, 'params'> & { params: LimitParams } => {
  const p = e.params as unknown;
  return !!p && typeof (p as LimitParams).limit === 'number';
};

const hasFormat = (e: RJSFValidationError): e is Omit<RJSFValidationError, 'params'> & { params: FormatParams } => {
  const p = e.params as unknown;
  return !!p && typeof (p as FormatParams).format === 'string';
};

/**
 * The keys are namespace-qualified because the transformer is called both from the form and
 * from summary validation, whose t functions are bound to different namespaces.
 */
const validationKey = (key: string) => `validation:${key}`;

// Mapping from error name to translation key for limit-based errors
const limitErrorMap: Record<string, string> = {
  minItems: 'min_items',
  maxItems: 'max_items',
  minimum: 'minimum',
  maximum: 'maximum',
};

// Mapping from format type to translation key
const formatMap: Record<string, string> = {
  email: 'email',
  uri: 'url',
  url: 'url',
  date: 'date',
  'date-time': 'date_time',
};

function propertiesOf(schema: RJSFSchema): Record<string, RJSFSchema> | undefined {
  return schema.properties as Record<string, RJSFSchema> | undefined;
}

function isSchemaObject(value: unknown): value is RJSFSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Conditional fields can live in if/then branches rather than directly under `properties`, so
 * the lookup follows the same branches the form renders fields from.
 */
function propertySchemaOf(schema: RJSFSchema, property: string): RJSFSchema | undefined {
  const direct = propertiesOf(schema)?.[property];
  if (direct) return direct;

  const branches: unknown[] = [...(Array.isArray(schema.allOf) ? schema.allOf : []), schema.then, schema.else];
  for (const branch of branches) {
    if (!isSchemaObject(branch)) continue;
    const found = propertySchemaOf(branch, property);
    if (found) return found;
  }

  return undefined;
}

/**
 * Turns an error path (e.g. `.facility.orgName`) into the field's title from the schema, so a
 * summary error can name the field exactly as the form shows it.
 */
export function fieldTitleFromSchema(schema: RJSFSchema, property: string | undefined): string | undefined {
  const path = (property ?? '').split('.').filter(Boolean);
  if (path.length === 0) return undefined;

  let current: RJSFSchema = schema;
  let title: string | undefined;

  for (const segment of path) {
    const next = propertySchemaOf(current, segment);
    if (!next) return undefined;
    title = typeof next.title === 'string' ? next.title : undefined;
    current = next;
  }

  return title;
}

// Get limit from schema based on property path
function getLimitFromSchema(
  schema: RJSFSchema,
  property: string,
  keyword: 'minLength' | 'maxLength'
): number | undefined {
  const props = propertiesOf(schema);
  if (!props) return undefined;
  const propSchema = props[property];
  if (!propSchema) return undefined;
  return propSchema[keyword];
}

export function createJsonErrorTransformer(schema: RJSFSchema, t: TFunction) {
  return (errors: RJSFValidationError[]): RJSFValidationError[] =>
    errors.map((e) => {
      if (e.name === 'required') {
        return { ...e, message: t(validationKey('required')) };
      }

      // Handle minLength/maxLength - both standard AJV and custom keyword
      if (e.name === 'minLength' || e.name === 'maxLength' || e.message?.includes(`"${e.name}"`)) {
        const keyword = e.name as 'minLength' | 'maxLength';
        const limit =
          hasLimit(e) ? e.params.limit : getLimitFromSchema(schema, e.property?.replace('.', '') ?? '', keyword);
        if (limit !== undefined) {
          const translationKey = keyword === 'minLength' ? 'min_length' : 'max_length';
          return { ...e, message: t(validationKey(translationKey), { limit }) };
        }
      }

      // Handle other limit-based errors using lookup table
      const limitTranslationKey = limitErrorMap[e.name ?? ''];
      if (limitTranslationKey && hasLimit(e)) {
        return { ...e, message: t(validationKey(limitTranslationKey), { limit: e.params.limit }) };
      }

      if (e.name === 'pattern') {
        return { ...e, message: t(validationKey('pattern')) };
      }

      if (e.name === 'format' && hasFormat(e)) {
        const translationKey = formatMap[e.params.format];
        return {
          ...e,
          message: t(
            validationKey(translationKey || 'format'),
            translationKey ? undefined : { format: e.params.format }
          ),
        };
      }

      if (e.name === 'enum' || e.name === 'not') {
        return { ...e, message: t(validationKey('required')) };
      }

      // Handle const errors (e.g. checkbox that must be true)
      if (e.name === 'const') {
        return { ...e, message: t(validationKey('checkbox_required')) };
      }

      return e;
    });
}

export default createJsonErrorTransformer;
