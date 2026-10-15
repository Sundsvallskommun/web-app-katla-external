'use client';
import { ArrayFieldItemTemplate, ArrayFieldTemplate } from '@components/json/fields/array-field-template.component';
import { FieldTemplate } from '@components/json/fields/field-template.component';
import { ObjectFieldTemplate } from '@components/json/fields/object-field-template.component';
import { SubmitButtonFieldTemplate } from '@components/json/fields/submit-button-field-template.component';
import { ROW_INDEX_PLACEHOLDER } from '@components/json/utils/row-index-placeholder';
import { stripHiddenFields } from '@components/json/utils/schema-conditions';
import { jsonWidgets } from '@components/json/widgets';
import Form, { IChangeEvent } from '@rjsf/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import createJsonErrorTransformer from '../utils/schema-form-error-handling';
import { getFormSchemaValidator } from './form-schema-validator';

/**
 * RJSF names a nested field `${parentId}_${propertyName}`. The ids are built here rather than
 * parsed back, because a property name may itself contain the separator (`ansokan_6116`).
 */
function collectSchemasById(schema: RJSFSchema, id = 'root', collected: Record<string, RJSFSchema> = {}) {
  collected[id] = schema;
  const properties = schema.properties as Record<string, RJSFSchema> | undefined;
  for (const [name, child] of Object.entries(properties ?? {})) {
    const childId = `${id}_${name}`;
    if (child.type === 'object') collectSchemasById(child, childId, collected);
    // Every row of a dynamic table renders from the same item schema, but RJSF numbers the rows in
    // the id. The row number is not known here, so the schema is stored under the placeholder the
    // lookup below puts back.
    const items = child.items as RJSFSchema | undefined;
    if (child.type === 'array' && items?.type === 'object') {
      collectSchemasById(items, `${childId}_${ROW_INDEX_PLACEHOLDER}`, collected);
    }
  }
  return collected;
}

interface SchemaFormProps {
  schemaId: string;
  schema: RJSFSchema;
  uiSchema?: UiSchema<Record<string, unknown>>;
  formData?: Record<string, unknown>;
  onChange?: (data: Record<string, unknown>, e?: IChangeEvent) => void;
  onSubmit?: (payload: Record<string, unknown>, e: IChangeEvent) => void;
  hideSubmitButton?: boolean;
  showValidation?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export default function SchemaForm({
  schemaId,
  schema,
  uiSchema = {},
  formData,
  onChange,
  onSubmit,
  hideSubmitButton = false,
  showValidation,
  disabled = false,
  compact = false,
}: SchemaFormProps) {
  const { t } = useTranslation('validation');
  const [localData, setLocalData] = useState<Record<string, unknown>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const data = formData ?? localData;
  const shouldValidate = showValidation ?? hasSubmitted;
  const validator = useMemo(() => getFormSchemaValidator(schemaId), [schemaId]);

  // A branch the user has navigated away from must not keep submitting its answers, so the data of
  // fields that are no longer visible is dropped as it changes.
  const handleChange = useCallback(
    (e: IChangeEvent<Record<string, unknown>>) => {
      const fd = stripHiddenFields(schema, e.formData);
      if (formData !== undefined) {
        onChange?.(fd, e);
      } else {
        setLocalData(fd);
      }
    },
    [formData, onChange, schema]
  );

  const handleSubmit = useCallback(
    (e: IChangeEvent<Record<string, unknown>>) => {
      setHasSubmitted(true);
      onSubmit?.(e.formData ?? {}, e);
    },
    [onSubmit]
  );

  const errorTransformer = useMemo(() => createJsonErrorTransformer(schema, t), [schema, t]);

  // Passes the original schema through formContext so ObjectFieldTemplate can read the
  // conditionals. `schemaById` is keyed the way RJSF builds field ids, so a nested object is
  // matched to its own sub-schema rather than to the root's.
  const schemaById = useMemo(() => collectSchemasById(schema), [schema]);
  const formContext = useMemo(
    () => ({ originalSchema: schema, schemaById, compact, validationActive: shouldValidate }),
    [schema, schemaById, compact, shouldValidate]
  );

  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={data}
      formContext={formContext}
      onChange={handleChange}
      onSubmit={handleSubmit}
      validator={validator}
      widgets={jsonWidgets}
      templates={{
        ArrayFieldTemplate,
        ArrayFieldItemTemplate,
        FieldTemplate,
        ObjectFieldTemplate,
        ButtonTemplates: {
          SubmitButton: hideSubmitButton ? () => null : SubmitButtonFieldTemplate,
        },
      }}
      // A `oneOf` of consts is how the schemas state a choice; RJSF would otherwise default every
      // such question to its first alternative, filing answers the citizen never gave and
      // revealing the fields that depend on them.
      experimental_defaultFormStateBehavior={{ constAsDefaults: 'skipOneOf' }}
      transformErrors={errorTransformer}
      noHtml5Validate
      showErrorList={false}
      liveValidate={shouldValidate}
      disabled={disabled}
    />
  );
}
