import { matchesSchemaCondition, type SchemaCondition } from '@components/json/utils/schema-conditions';
import {
  isJsonObject,
  loadFormSchema,
  schemaNamesForErrand,
  SchemaNotFoundError,
} from '@components/json/utils/schema-utils';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import type { RJSFSchema } from '@rjsf/utils';
import { answersOfErrand } from '@utils/errand-attachments';
import type { TFunction } from 'i18next';

/**
 * An answer that rules the application out, declared by the schema under `x-stops`. While `when`
 * matches the root answers, `text` explains why and the errand cannot be registered.
 */
export interface SchemaStop {
  when: SchemaCondition;
  text: string;
}

const STOPS_KEYWORD = 'x-stops';

// `when.required` is both the pairing the condition rules demand and where the text is shown.
const isSchemaStop = (value: unknown): value is SchemaStop =>
  isJsonObject(value) &&
  typeof value.text === 'string' &&
  isJsonObject(value.when) &&
  Array.isArray(value.when.required) &&
  value.when.required.length > 0;

/** Malformed entries are skipped, as with `x-attachments`; the BFF logs them. */
export const stopsOfSchema = (schema: RJSFSchema | null | undefined): SchemaStop[] => {
  const declared: unknown = schema?.[STOPS_KEYWORD];
  return Array.isArray(declared) ? (declared as unknown[]).filter(isSchemaStop) : [];
};

export const activeStops = (stops: readonly SchemaStop[], answers: unknown): SchemaStop[] =>
  stops.filter((stop) => matchesSchemaCondition(stop.when, answers));

/** The field a stop is shown under: the last one its condition requires. */
export const stopAnchor = (stop: SchemaStop): string | undefined => stop.when.required?.at(-1);

/** Judged against the published schema, like the bilagor; an unreadable schema fails closed. */
export async function validateErrandStops(
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
      if (error instanceof SchemaNotFoundError) continue;
      return [t('validation:stops.check_failed')];
    }

    const [stop] = activeStops(stopsOfSchema(schema), answersOfErrand(values, schemaName));
    if (stop) return [stop.text];
  }

  return [];
}
