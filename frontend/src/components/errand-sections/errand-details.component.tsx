'use client';

import { useFormSchema } from '@components/json/hooks/use-form-schema';
import SchemaForm from '@components/json/schema/schema-form.component';
import {
  errandFormDataContractErrorMessage,
  isJsonObject,
  parseErrandFormData,
  schemaNamesForErrand,
  upsertErrandFormDataItem,
} from '@components/json/utils/schema-utils';
import { useErrandLocked } from '@contexts/errand-content-lock-context';
import { useFormValidation } from '@contexts/form-validation-context';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from 'src/stores/metadata-store';

interface SchemaFormFieldProps {
  schemaName: string;
  compact?: boolean;
}

function SchemaFormField({ schemaName, compact }: SchemaFormFieldProps) {
  const { getValues, watch, setValue } = useFormContext<ErrandFormDTO>();
  const { showValidation } = useFormValidation();
  const { t } = useTranslation('forms');
  const errandFormData = watch('errandFormData');
  const entry = errandFormData?.find((candidate) => candidate.schemaName === schemaName);
  const { schema, uiSchema, schemaId, loading, error, notFound } = useFormSchema(
    schemaName,
    entry === undefined ? { kind: 'new' } : { kind: 'persisted', schemaId: entry.schemaId }
  );
  const isLocked = useErrandLocked();

  const rawData = entry?.data ?? '{}';
  const parsedFormData = parseErrandFormData(rawData, schemaName);
  const formData = parsedFormData.valid && isJsonObject(parsedFormData.value) ? parsedFormData.value : undefined;
  const formDataError =
    !parsedFormData.valid ? errandFormDataContractErrorMessage(parsedFormData.error, t)
    : !formData ? t('unsupported_form_data', { schemaName })
    : undefined;

  const handleChange = useCallback(
    (data: Record<string, unknown>) => {
      if (!schemaId) {
        throw new Error(`Cannot update ${schemaName} without a schema ID`);
      }
      setValue(
        'errandFormData',
        upsertErrandFormDataItem(getValues('errandFormData'), {
          schemaName,
          schemaId,
          data: JSON.stringify(data),
        })
      );
    },
    [getValues, schemaId, schemaName, setValue]
  );

  if (formDataError) {
    return (
      <div role="alert" className="text-error">
        {formDataError}
      </div>
    );
  }

  if (loading) {
    return <div className="text-gray-500">{t('errand-information:errand_details.loading_form')}</div>;
  }

  // An errand type whose flow has no schema simply has no fields to fill in.
  if (notFound) {
    return <span className="text-dark-secondary">{t('errand-information:section_placeholder')}</span>;
  }

  if (error || !schema || !schemaId) {
    return <div className="text-error">Fel: {error ?? 'Kunde inte ladda schema'}</div>;
  }

  return (
    <SchemaForm
      schemaId={schemaId}
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      onChange={handleChange}
      hideSubmitButton
      showValidation={showValidation}
      disabled={isLocked}
      compact={compact}
    />
  );
}

interface ErrandDetailsProps {
  compact?: boolean;
}

export const ErrandDetails: React.FC<ErrandDetailsProps> = ({ compact }) => {
  const { t } = useTranslation('errand-information');
  const { watch } = useFormContext<ErrandFormDTO>();
  const namespace = useMetadataStore((state) => state.metadata?.namespace);
  const schemaNames = schemaNamesForErrand(watch('labels'), namespace);

  // The errand type chooses the form, so before it is categorized — or for a type whose flow has
  // no schema — there is nothing to render. The placeholder distinguishes "no fields yet" from
  // "the schema failed to load".
  if (schemaNames.length === 0) {
    return <span className="text-dark-secondary">{t('section_placeholder')}</span>;
  }

  return (
    <div className="flex flex-col gap-24">
      {schemaNames.map((schemaName) => (
        <SchemaFormField key={schemaName} schemaName={schemaName} compact={compact} />
      ))}
    </div>
  );
};
