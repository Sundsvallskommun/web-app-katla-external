import type { RJSFSchema } from '@rjsf/utils';

/**
 * Conditional visibility for JSON Schema forms, shared by the renderer and by the pruning that
 * keeps hidden answers out of the submitted value — so what is shown and what is kept cannot drift.
 *
 * Ported from Draken's `sections-object-field-template.componant.tsx`; both apps render the same
 * schemas, so the predicate has to agree. Kept as its own module here so it can be tested directly.
 */

export interface SchemaCondition {
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, SchemaCondition | boolean>;
  required?: string[];
  contains?: SchemaCondition | boolean;
  allOf?: (SchemaCondition | boolean)[];
  anyOf?: (SchemaCondition | boolean)[];
  oneOf?: (SchemaCondition | boolean)[];
  not?: SchemaCondition | boolean;
}

interface ConditionalRule {
  if: SchemaCondition;
  then: {
    required?: string[];
    properties?: Record<string, unknown>;
  };
}

const SUPPORTED_KEYWORDS = new Set<string>([
  'const',
  'enum',
  'properties',
  'required',
  'contains',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
]);

const hasOwn = (value: object, key: string): boolean => Object.hasOwn(value, key);

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const matchesRequiredFields = (required: readonly string[] | undefined, value: unknown): boolean =>
  !required || (isRecordValue(value) && required.every((fieldName) => hasOwn(value, fieldName)));

const matchesProperties = (properties: SchemaCondition['properties'], value: unknown): boolean =>
  !properties ||
  (isRecordValue(value) &&
    Object.entries(properties).every(
      ([fieldName, fieldCondition]) =>
        !hasOwn(value, fieldName) || matchesSchemaCondition(fieldCondition, value[fieldName])
    ));

const matchesContains = (contains: SchemaCondition['contains'], value: unknown): boolean =>
  !contains || (Array.isArray(value) && value.some((item) => matchesSchemaCondition(contains, item)));

const matchesCombinators = (condition: SchemaCondition, value: unknown): boolean => {
  if (condition.allOf && !condition.allOf.every((part) => matchesSchemaCondition(part, value))) return false;
  if (condition.anyOf && !condition.anyOf.some((part) => matchesSchemaCondition(part, value))) return false;
  if (condition.oneOf && condition.oneOf.filter((part) => matchesSchemaCondition(part, value)).length !== 1) {
    return false;
  }
  return condition.not === undefined || !matchesSchemaCondition(condition.not, value);
};

/**
 * An absent key satisfies `properties` — correct JSON Schema, and the reason a rule must pair
 * `if.properties` with `if.required`. Without the pairing the condition holds before the user has
 * answered, and the dependent field appears immediately.
 */
export function matchesSchemaCondition(condition: SchemaCondition | boolean, value: unknown): boolean {
  if (typeof condition === 'boolean') return condition;
  if (hasOwn(condition, 'const') && !Object.is(value, condition.const)) return false;
  if (condition.enum && !condition.enum.some((enumValue) => Object.is(enumValue, value))) return false;
  if (!matchesRequiredFields(condition.required, value)) return false;
  if (!matchesProperties(condition.properties, value)) return false;
  if (!matchesContains(condition.contains, value)) return false;
  return matchesCombinators(condition, value);
}

const warnedKeywords = new Set<string>();

/**
 * Schemas are maintained in the jsonschema service, so an unsupported keyword reaches the citizen
 * with no build step in between. Unknown keywords are skipped rather than failing the match — an
 * extra visible field is recoverable, a silently hidden one means the answer is never collected.
 * The BFF logs the same gap server side (schema-contract.ts); this warn is the in-browser trace.
 */
function warnAboutUnsupportedKeywords(condition: SchemaCondition | boolean): void {
  if (typeof condition === 'boolean') return;

  for (const keyword of Object.keys(condition)) {
    if (SUPPORTED_KEYWORDS.has(keyword) || warnedKeywords.has(keyword)) continue;
    warnedKeywords.add(keyword);
    console.warn(`Unsupported JSON Schema condition keyword "${keyword}"; the field it guards is shown regardless.`);
  }

  for (const nested of Object.values(condition.properties ?? {})) warnAboutUnsupportedKeywords(nested);
  for (const part of [...(condition.allOf ?? []), ...(condition.anyOf ?? []), ...(condition.oneOf ?? [])]) {
    warnAboutUnsupportedKeywords(part);
  }
  if (condition.contains !== undefined) warnAboutUnsupportedKeywords(condition.contains);
  if (condition.not !== undefined) warnAboutUnsupportedKeywords(condition.not);
}

/**
 * Field name to the conditions that reveal it. A field named by several rules gets several
 * conditions, and any one of them showing is enough.
 */
export function getConditionalFields(schema: RJSFSchema | undefined): Map<string, SchemaCondition[]> {
  const conditionalFields = new Map<string, SchemaCondition[]>();
  if (!schema) return conditionalFields;

  const addConditionalField = (fieldName: string, condition: SchemaCondition) => {
    const currentConditions = conditionalFields.get(fieldName) ?? [];
    if (!currentConditions.includes(condition)) {
      conditionalFields.set(fieldName, [...currentConditions, condition]);
    }
  };

  const addRule = (rule: ConditionalRule) => {
    warnAboutUnsupportedKeywords(rule.if);
    for (const field of rule.then.required ?? []) addConditionalField(field, rule.if);
    for (const field of Object.keys(rule.then.properties ?? {})) addConditionalField(field, rule.if);
  };

  const allOf = schema.allOf as ConditionalRule[] | undefined;
  for (const rule of allOf ?? []) {
    if (rule.if && rule.then) addRule(rule);
  }

  const rootIf = schema.if as SchemaCondition | undefined;
  const rootThen = schema.then as ConditionalRule['then'] | undefined;
  if (rootIf && rootThen) addRule({ if: rootIf, then: rootThen });

  return conditionalFields;
}

/** The fields of one object that should render, given its own conditions and its own data. */
export function visibleFields(
  schema: RJSFSchema | undefined,
  formData: Record<string, unknown> | undefined,
  fieldNames: readonly string[]
): Set<string> {
  const conditionalFields = getConditionalFields(schema);
  const data = formData ?? {};

  return new Set(
    fieldNames.filter((fieldName) => {
      const conditions = conditionalFields.get(fieldName);
      return !conditions || conditions.some((condition) => matchesSchemaCondition(condition, data));
    })
  );
}

const schemaOfProperty = (schema: RJSFSchema | undefined, property: string): RJSFSchema | undefined => {
  const properties = schema?.properties as Record<string, RJSFSchema> | undefined;
  return properties?.[property];
};

/**
 * Drops the answers to fields that are currently hidden, so switching branch does not leave the
 * abandoned one's answers in the saved value. Matches OpenE, where every rule in the AoT flow has
 * `doNotResetQueryState: false`. Each object is judged against its own conditions and data slice.
 */
export function stripHiddenFields(
  schema: RJSFSchema | undefined,
  formData: Record<string, unknown> | undefined
): Record<string, unknown> {
  const data = formData ?? {};
  const visible = visibleFields(schema, data, Object.keys(data));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!visible.has(key)) continue;
    const childSchema = schemaOfProperty(schema, key);
    result[key] = isRecordValue(value) && childSchema ? stripHiddenFields(childSchema, value) : value;
  }
  return result;
}
