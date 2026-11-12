import type { RJSFSchema, UiSchema } from '@rjsf/utils';

export interface SectionDefinition {
  id: string;
  title: string;
  icon?: string;
  fields: string[];
  defaultOpen?: boolean;
}

export const getSectionDefinitions = <T>(uiSchema: UiSchema<T> | undefined): SectionDefinition[] =>
  (uiSchema?.['ui:sections'] ?? []) as SectionDefinition[];

/** A `ui:sections` entry as a part of the form that can be shown and validated on its own. */
export interface SchemaSection {
  schemaName: string;
  id: string;
  title: string;
  fields: readonly string[];
}

/**
 * The contract puts every field in exactly one section. A field left outside goes with the last
 * section, so that splitting the form never makes a question unreachable.
 */
export const schemaSectionsOf = (
  schemaName: string,
  schema: RJSFSchema,
  uiSchema: UiSchema<Record<string, unknown>> | undefined
): SchemaSection[] => {
  const definitions = getSectionDefinitions(uiSchema);
  const placed = new Set(definitions.flatMap((section) => section.fields));
  const unplaced = Object.keys(schema.properties ?? {}).filter((field) => !placed.has(field));

  return definitions.map((section, index) => ({
    schemaName,
    id: section.id,
    title: section.title,
    fields: index === definitions.length - 1 ? [...section.fields, ...unplaced] : section.fields,
  }));
};
