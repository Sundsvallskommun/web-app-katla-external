'use client';
import { SectionStatus, SectionStatusLabel } from '@components/disclosure/section-status-label.component';
import { ErrandContentLock } from '@components/errand-content-lock/errand-content-lock.component';
import { ROW_INDEX_PLACEHOLDER } from '@components/json/utils/row-index-placeholder';
import { visibleFields as fieldsVisibleIn } from '@components/json/utils/schema-conditions';
import { ErrorAlert } from '@components/misc/error-alert.component';
import type { ErrorSchema, ObjectFieldTemplateProps, RJSFSchema, UiSchema } from '@rjsf/utils';
import { Checkbox, Disclosure, Divider, Label } from '@sk-web-gui/react';
import { INVALID_FIELD_ATTRIBUTE } from '@utils/focus-first-error';
import { activeStops, stopAnchor, stopsOfSchema } from '@utils/schema-stops';
import { icons } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';

interface RowDefinition {
  fields: string[];
  gap?: string;
}

interface SectionDefinition {
  id: string;
  title: string;
  icon?: string;
  fields: string[];
  defaultOpen?: boolean;
}

interface FormContext {
  originalSchema?: RJSFSchema;
  /** Sub-schema per RJSF field id, so a nested object is judged by its own conditions. */
  schemaById?: Record<string, RJSFSchema>;
  compact?: boolean;
  validationActive?: boolean;
}

/**
 * Extracts row definitions from uiSchema
 */
function getRowDefinitions(uiSchema: UiSchema | undefined): RowDefinition[] {
  return (uiSchema?.['ui:rows'] ?? []) as RowDefinition[];
}

/**
 * Extracts section definitions from uiSchema
 */
function getSectionDefinitions(uiSchema: UiSchema | undefined): SectionDefinition[] {
  return (uiSchema?.['ui:sections'] ?? []) as SectionDefinition[];
}

/**
 * The ui schema uses Lucide's stable kebab-case names, while lucide-react's icon registry keys
 * on PascalCase.
 */
function getSectionIcon(iconName: string | undefined) {
  if (!iconName) return undefined;

  const iconKey = iconName
    .trim()
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('') as keyof typeof icons;

  return icons[iconKey];
}

/**
 * A field can carry errors both on itself and in nested objects, so the whole branch is walked.
 */
function containsErrors(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false;

  const branch = node as Record<string, unknown>;
  if (Array.isArray(branch.__errors) && branch.__errors.length > 0) return true;

  return Object.entries(branch).some(([key, value]) => key !== '__errors' && containsErrors(value));
}

function sectionHasErrors(fieldNames: string[], errorSchema: ErrorSchema | undefined): boolean {
  if (!errorSchema) return false;
  const errors = errorSchema as Record<string, unknown>;
  return fieldNames.some((fieldName) => containsErrors(errors[fieldName]));
}

/**
 * Section component with completion checkbox
 */
interface SectionDisclosureProps {
  section: SectionDefinition;
  status?: SectionStatus;
  children: React.ReactNode;
}

function SectionDisclosure({ section, status, children }: SectionDisclosureProps) {
  const { t } = useTranslation('forms');
  // Open unless stated otherwise, matching ErrandDisclosure. Set defaultOpen:false in
  // ui:sections to close an individual section.
  const [open, setOpen] = useState(section.defaultOpen ?? true);
  const [doneMark, setDoneMark] = useState(false);
  const SectionIcon = getSectionIcon(section.icon);

  const handleDoneMarkChange = () => {
    const newDoneMark = !doneMark;
    setDoneMark(newDoneMark);

    if (newDoneMark) {
      setOpen(false);
    }
  };

  return (
    <Disclosure variant="alt" className="w-full" open={open} onToggleOpen={setOpen}>
      <Disclosure.Header>
        {SectionIcon && <Disclosure.Icon icon={React.createElement(SectionIcon)} />}
        {/* min-w-0 lets the heading shrink instead of pushing the status label off the edge */}
        <Disclosure.Title className="min-w-0">{section.title}</Disclosure.Title>
        {status && <SectionStatusLabel status={status} data-cy={`section-status-${section.id}`} />}
        {doneMark && status !== 'complete' && (
          <Label inverted rounded color="gronsta" className="sk-disclosure-label whitespace-nowrap">
            {t('section_complete')}
          </Label>
        )}
        <Disclosure.Button />
      </Disclosure.Header>
      <Disclosure.Content>
        <ErrandContentLock>
          {children}
          <Divider className="mt-16" />
          {appConfig.features.disclosureDoneMark && (
            <Checkbox className="mt-16" onClick={handleDoneMarkChange} checked={doneMark}>
              {t('errand-information:section.mark_complete')}
            </Checkbox>
          )}
        </ErrandContentLock>
      </Disclosure.Content>
    </Disclosure>
  );
}

/** Stop texts per field they are shown under. Stops are root-level, so only the root has any. */
function stopsByAnchor(ctx: FormContext | undefined, id: string, formData: unknown): Map<string, string[]> {
  const byAnchor = new Map<string, string[]>();
  if (id !== 'root') return byAnchor;

  for (const stop of activeStops(stopsOfSchema(ctx?.originalSchema), formData)) {
    const anchor = stopAnchor(stop);
    if (anchor) byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), stop.text]);
  }
  return byAnchor;
}

/** Puts the stop texts under the content, and marks it for error navigation while a stop holds. */
function withStops(key: string, content: React.ReactNode, texts: string[]) {
  if (texts.length === 0) return content;
  return (
    <div key={key} {...{ [INVALID_FIELD_ATTRIBUTE]: key }} data-cy="schema-stop">
      {content}
      {texts.map((text) => (
        <ErrorAlert key={text} className="mt-16" message={text} />
      ))}
    </div>
  );
}

/**
 * Renders fields based on order, rows, and visibility
 */
function renderFields(
  fieldNames: string[],
  properties: ObjectFieldTemplateProps['properties'],
  visibleFields: Set<string>,
  rows: RowDefinition[],
  rowFieldNames: Set<string>,
  renderedRows: Set<string>,
  compact = false,
  stops = new Map<string, string[]>()
) {
  return fieldNames.map((fieldName) => {
    // Skip hidden fields
    if (!visibleFields.has(fieldName)) return null;

    // Check if field is the first field in a row
    const row = rows.find((r) => r.fields[0] === fieldName);
    if (row) {
      // Skip if we've already rendered this row
      const rowKey = row.fields.join('-');
      if (renderedRows.has(rowKey)) return null;
      renderedRows.add(rowKey);

      // Filter out hidden fields from the row
      const visibleRowFields = row.fields.filter((f) => visibleFields.has(f));
      if (visibleRowFields.length === 0) return null;

      return withStops(
        rowKey,
        <div key={rowKey} className={`flex ${compact ? 'flex-col gap-32' : (row.gap ?? '') || 'gap-32'}`}>
          {visibleRowFields.map((f) => {
            const prop = properties.find((p) => p.name === f);
            return prop ?
                <div key={f} className={compact ? '' : 'flex-1'}>
                  {prop.content}
                </div>
              : null;
          })}
        </div>,
        visibleRowFields.flatMap((f) => stops.get(f) ?? [])
      );
    }

    // Skip if field is part of a row but not the first (already rendered with row)
    if (rowFieldNames.has(fieldName)) return null;

    // Standalone field
    const prop = properties.find((p) => p.name === fieldName);
    return prop ? withStops(fieldName, <div key={fieldName}>{prop.content}</div>, stops.get(fieldName) ?? []) : null;
  });
}

/**
 * The sub-schema this object is judged by. A dynamic table's rows are keyed with the row number
 * replaced by a placeholder, because every row renders from the same item schema.
 *
 * Falling back to the root schema would be worse than having none: a row column that shares its
 * name with a conditional question at the root — `personnummer` does — would be judged by that
 * question's condition and silently disappear from the row.
 */
function schemaForObject(ctx: FormContext | undefined, id: string): RJSFSchema | undefined {
  const byId = ctx?.schemaById;
  const rowAgnosticId = id.replace(/_\d+(?=_|$)/g, `_${ROW_INDEX_PLACEHOLDER}`);
  return byId?.[id] ?? byId?.[rowAgnosticId] ?? (id === 'root' ? ctx?.originalSchema : undefined);
}

/**
 * ObjectFieldTemplate that hides fields based on if/then conditions in the schema
 * and supports ui:rows for horizontal field grouping and ui:sections for Disclosure grouping
 */
export function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { properties, uiSchema, errorSchema } = props;
  const formData = props.formData as Record<string, unknown> | undefined;

  // RJSF strips allOf from the schema prop, so the conditions come from formContext instead.
  const ctx = props.formContext as FormContext | undefined;
  const objectSchema = schemaForObject(ctx, props.idSchema.$id);

  // Get row and section definitions from uiSchema
  const rows = getRowDefinitions(uiSchema);
  const rowFieldNames = new Set(rows.flatMap((r) => r.fields));
  const sections = getSectionDefinitions(uiSchema);

  // Get field order from uiSchema or use properties order
  const order = uiSchema?.['ui:order'] ?? properties.map((p) => p.name);

  const stops = stopsByAnchor(ctx, props.idSchema.$id, formData);

  const visibleFields = fieldsVisibleIn(
    objectSchema,
    formData,
    properties.map((prop) => prop.name)
  );

  const compact = ctx?.compact ?? false;
  const validationActive = ctx?.validationActive ?? false;

  // If no sections defined, use original flat rendering
  if (sections.length === 0) {
    const renderedRows = new Set<string>();
    const renderedFields = (
      <div className="flex flex-col gap-32">
        {renderFields(order, properties, visibleFields, rows, rowFieldNames, renderedRows, compact, stops)}
      </div>
    );

    // Nested objects get no label from FieldTemplate, so a question built out of sub-fields
    // ("Serveringsställets besöksadress") loses its text unless the ui schema asks for a fieldset.
    const showObjectFieldset = uiSchema?.['ui:options']?.showObjectFieldset === true;
    if (!showObjectFieldset || props.idSchema.$id === 'root') return renderedFields;

    return (
      <fieldset className="w-full min-w-0 max-w-full border-0 p-0" data-cy="schema-object-fieldset">
        {props.title && (
          <legend className="max-w-full whitespace-normal break-words text-label-medium font-bold">
            {props.title}
            {props.required ? '*' : ''}
          </legend>
        )}
        {/* The description is FieldTemplate's: RJSF hands it over as the raw ui:description
            markup, which would render as escaped text here. */}
        {renderedFields}
      </fieldset>
    );
  }

  // Track which fields belong to sections
  const sectionFieldNames = new Set(sections.flatMap((s) => s.fields));

  // Find fields not in any section (to render at the end)
  const unsectionedFields = order.filter((f) => !sectionFieldNames.has(f) && visibleFields.has(f));

  // Track rendered rows across all sections
  const renderedRows = new Set<string>();

  return (
    <div className="flex flex-col gap-32">
      {/* Render sections */}
      {sections.map((section) => {
        // Get visible fields for this section in order
        const sectionFieldsInOrder = order.filter((f) => section.fields.includes(f) && visibleFields.has(f));

        // Skip empty sections
        if (sectionFieldsInOrder.length === 0) return null;

        if (compact) {
          return (
            <div key={section.id} className="flex flex-col gap-32">
              {renderFields(
                sectionFieldsInOrder,
                properties,
                visibleFields,
                rows,
                rowFieldNames,
                renderedRows,
                compact,
                stops
              )}
            </div>
          );
        }

        const status =
          !validationActive ? undefined
          : sectionHasErrors(sectionFieldsInOrder, errorSchema) ? 'error'
          : 'complete';

        return (
          <SectionDisclosure key={section.id} section={section} status={status}>
            <div className="flex flex-col gap-32 py-16">
              {renderFields(
                sectionFieldsInOrder,
                properties,
                visibleFields,
                rows,
                rowFieldNames,
                renderedRows,
                false,
                stops
              )}
            </div>
          </SectionDisclosure>
        );
      })}

      {/* Render fields not in any section */}
      {unsectionedFields.length > 0 && (
        <div className="flex flex-col gap-32">
          {renderFields(
            unsectionedFields,
            properties,
            visibleFields,
            rows,
            rowFieldNames,
            renderedRows,
            compact,
            stops
          )}
        </div>
      )}
    </div>
  );
}
