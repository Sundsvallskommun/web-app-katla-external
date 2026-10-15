import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/utils/logger';

/**
 * Structural checks on a fetched JSON schema. The generator that once guaranteed these is retired
 * and schemas are maintained in the jsonschema service, so a violation reaches the BFF with no
 * build step in between. Structural violations fail closed (502): a condition that points at a
 * property the schema lacks means a field or bilaga the citizen can never reach. Presentation
 * issues only log — the renderer fails open on those by design. See
 * docs/schema-control-assumptions.md for the full authoring contract.
 */

const SUPPORTED_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

// Must match SUPPORTED_KEYWORDS in the frontend's schema-conditions.ts — the renderer shows a
// guarded field when its condition uses a keyword outside this set.
const SUPPORTED_CONDITION_KEYWORDS = new Set(['const', 'enum', 'properties', 'required', 'contains', 'allOf', 'anyOf', 'oneOf', 'not']);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (schemaId: string, message: string): never => {
  throw new HttpException(502, `Schema ${schemaId} violates the authoring contract: ${message}`);
};

const at = (path: string): string => (path === '' ? 'the schema root' : `'${path}'`);

/**
 * The fields of the surrounding object that a condition reads: its own `properties` keys and
 * `required` entries, plus the same through the combinators. `properties` sub-conditions and
 * `contains` match one field's value, not the object, so they add no references of their own.
 */
const conditionReferences = (condition: unknown): string[] => {
  if (!isRecord(condition)) return [];
  const references = [
    ...Object.keys(isRecord(condition.properties) ? condition.properties : {}),
    ...(Array.isArray(condition.required) ? condition.required.filter(entry => typeof entry === 'string') : []),
  ];
  for (const combinator of ['allOf', 'anyOf', 'oneOf'] as const) {
    const parts = condition[combinator];
    if (Array.isArray(parts)) parts.forEach(part => references.push(...conditionReferences(part)));
  }
  references.push(...conditionReferences(condition.not));
  return references;
};

const collectUnsupportedKeywords = (condition: unknown, found: Set<string>): void => {
  if (!isRecord(condition)) return;
  for (const keyword of Object.keys(condition)) {
    if (!SUPPORTED_CONDITION_KEYWORDS.has(keyword)) found.add(keyword);
  }
  for (const nested of Object.values(isRecord(condition.properties) ? condition.properties : {})) collectUnsupportedKeywords(nested, found);
  for (const combinator of ['allOf', 'anyOf', 'oneOf'] as const) {
    const parts = condition[combinator];
    if (Array.isArray(parts))
      parts.forEach(part => {
        collectUnsupportedKeywords(part, found);
      });
  }
  collectUnsupportedKeywords(condition.not, found);
  collectUnsupportedKeywords(condition.contains, found);
};

interface VisibilityRule {
  if: Record<string, unknown>;
  then: Record<string, unknown>;
}

/** The rules the renderer reads: `allOf: [{if, then}]` entries and a root-level if/then pair. */
const visibilityRules = (objectSchema: Record<string, unknown>): VisibilityRule[] => {
  const rules: VisibilityRule[] = [];
  if (Array.isArray(objectSchema.allOf)) {
    for (const entry of objectSchema.allOf) {
      if (isRecord(entry) && isRecord(entry.if) && isRecord(entry.then)) rules.push({ if: entry.if, then: entry.then });
    }
  }
  if (isRecord(objectSchema.if) && isRecord(objectSchema.then)) rules.push({ if: objectSchema.if, then: objectSchema.then });
  return rules;
};

const checkConditionAgainstProperties = (
  condition: unknown,
  propertyNames: Set<string>,
  schemaId: string,
  path: string,
  unsupported: Set<string>,
): void => {
  for (const reference of conditionReferences(condition)) {
    if (!propertyNames.has(reference)) fail(schemaId, `a condition at ${at(path)} refers to missing property '${reference}'`);
  }
  collectUnsupportedKeywords(condition, unsupported);
};

const checkObjectSchema = (objectSchema: Record<string, unknown>, schemaId: string, path: string, unsupported: Set<string>): void => {
  const properties = isRecord(objectSchema.properties) ? objectSchema.properties : {};
  const propertyNames = new Set(Object.keys(properties));

  for (const rule of visibilityRules(objectSchema)) {
    checkConditionAgainstProperties(rule.if, propertyNames, schemaId, path, unsupported);
    for (const target of Array.isArray(rule.then.required) ? rule.then.required : []) {
      if (typeof target === 'string' && !propertyNames.has(target)) {
        fail(schemaId, `a condition at ${at(path)} makes missing property '${target}' required`);
      }
    }
    for (const target of Object.keys(isRecord(rule.then.properties) ? rule.then.properties : {})) {
      if (!propertyNames.has(target)) fail(schemaId, `a condition at ${at(path)} reveals missing property '${target}'`);
    }
  }

  // Recurse the way the renderer's collectSchemasById does: object children and arrays of objects.
  for (const [name, child] of Object.entries(properties)) {
    if (!isRecord(child)) continue;
    const childPath = path === '' ? name : `${path}.${name}`;
    if (child.type === 'object') checkObjectSchema(child, schemaId, childPath, unsupported);
    if (child.type === 'array' && isRecord(child.items) && child.items.type === 'object') {
      checkObjectSchema(child.items, schemaId, childPath, unsupported);
    }
  }
};

const checkAttachments = (schema: Record<string, unknown>, schemaId: string, unsupported: Set<string>): void => {
  if (!('x-attachments' in schema)) return;
  const declared = schema['x-attachments'];
  if (!Array.isArray(declared)) {
    logger.warn(`Schema ${schemaId}: x-attachments is not an array; the Bilagor section will be empty`);
    return;
  }
  const rootProperties = new Set(Object.keys(isRecord(schema.properties) ? schema.properties : {}));
  for (const entry of declared) {
    if (!isRecord(entry) || typeof entry.key !== 'string' || typeof entry.label !== 'string') {
      logger.warn(`Schema ${schemaId}: malformed x-attachments entry is dropped by the frontend: ${JSON.stringify(entry)}`);
      continue;
    }
    if (isRecord(entry.requiredWhen)) {
      for (const reference of conditionReferences(entry.requiredWhen)) {
        if (!rootProperties.has(reference)) fail(schemaId, `bilaga '${entry.key}' is gated on missing property '${reference}'`);
      }
      collectUnsupportedKeywords(entry.requiredWhen, unsupported);
    }
  }
};

const checkStops = (schema: Record<string, unknown>, schemaId: string, unsupported: Set<string>): void => {
  if (!('x-stops' in schema)) return;
  const declared = schema['x-stops'];
  if (!Array.isArray(declared)) {
    logger.warn(`Schema ${schemaId}: x-stops is not an array; no answer will stop a registration`);
    return;
  }
  const rootProperties = new Set(Object.keys(isRecord(schema.properties) ? schema.properties : {}));
  for (const entry of declared) {
    const required = isRecord(entry) && isRecord(entry.when) ? entry.when.required : undefined;
    if (!isRecord(entry) || typeof entry.text !== 'string' || !Array.isArray(required) || required.length === 0) {
      logger.warn(`Schema ${schemaId}: malformed x-stops entry is dropped by the frontend: ${JSON.stringify(entry)}`);
      continue;
    }
    for (const reference of conditionReferences(entry.when)) {
      if (!rootProperties.has(reference)) fail(schemaId, `a stop is gated on missing property '${reference}'`);
    }
    collectUnsupportedKeywords(entry.when, unsupported);
  }
};

/**
 * Throws 502 on a structural contract violation; logs a warning per condition keyword the
 * renderer's condition engine does not understand (the guarded field is shown regardless).
 */
export const assertSchemaContract = (schema: Record<string, unknown>, schemaId: string): void => {
  if ('$schema' in schema && schema.$schema !== SUPPORTED_DIALECT) {
    fail(schemaId, `dialect must be draft 2020-12, got ${JSON.stringify(schema.$schema)}`);
  }

  const unsupported = new Set<string>();
  checkObjectSchema(schema, schemaId, '', unsupported);
  checkAttachments(schema, schemaId, unsupported);
  checkStops(schema, schemaId, unsupported);

  for (const keyword of unsupported) {
    logger.warn(`Schema ${schemaId}: condition keyword '${keyword}' is not understood by the renderer; guarded fields are shown regardless`);
  }
};
