import i18nConfig from '@app/i18nConfig';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  errandFormDataContractErrorMessage,
  loadFormSchema,
  loadFormSchemaForEntry,
  SchemaNotFoundError,
} from '../utils/schema-utils';

interface UseFormSchemaResult {
  schema: RJSFSchema | null;
  uiSchema: UiSchema<Record<string, unknown>> | undefined;
  schemaId: string | undefined;
  loading: boolean;
  error: string | null;
  /** The service has no schema by that name — the errand type has no form, which is not an error. */
  notFound: boolean;
}

export type FormSchemaSource =
  | { kind: 'new' }
  | {
      kind: 'persisted';
      schemaId?: string;
    };

export function useFormSchema(schemaName: string, source: FormSchemaSource = { kind: 'new' }): UseFormSchemaResult {
  const { t, i18n } = useTranslation('forms');
  const locale = i18n.resolvedLanguage ?? i18nConfig.defaultLocale;
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [uiSchema, setUiSchema] = useState<UiSchema<Record<string, unknown>> | undefined>(undefined);
  const [schemaId, setSchemaId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const loadedSchemaRef = useRef<{ schemaName: string; schemaId: string; locale: string } | null>(null);
  const sourceKind = source.kind;
  const persistedSchemaId = source.kind === 'persisted' ? source.schemaId : undefined;

  useEffect(() => {
    if (
      sourceKind === 'persisted' &&
      persistedSchemaId !== undefined &&
      loadedSchemaRef.current?.schemaName === schemaName &&
      loadedSchemaRef.current.schemaId === persistedSchemaId &&
      // Without the language in the comparison, a language switch would bail out here and keep
      // the previous language's schema.
      loadedSchemaRef.current.locale === locale
    ) {
      return;
    }

    let active = true;
    loadedSchemaRef.current = null;
    setLoading(true);
    setError(null);
    setNotFound(false);

    // Defer the loader call so a missing persisted ID becomes a rejected contract promise rather
    // than throwing synchronously out of the effect.
    const schemaPromise = Promise.resolve().then(() =>
      sourceKind === 'new' ?
        loadFormSchema(schemaName, t, locale)
      : loadFormSchemaForEntry(schemaName, persistedSchemaId, t, locale)
    );

    schemaPromise
      .then(({ schema: loadedSchema, uiSchema: loadedUiSchema, schemaId: loadedSchemaId }) => {
        if (!active) return;
        loadedSchemaRef.current = { schemaName, schemaId: loadedSchemaId, locale };
        setSchema(loadedSchema);
        setUiSchema(loadedUiSchema);
        setSchemaId(loadedSchemaId);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        loadedSchemaRef.current = null;
        setSchema(null);
        setUiSchema(undefined);
        setSchemaId(undefined);
        if (err instanceof SchemaNotFoundError) {
          setNotFound(true);
        } else {
          setError(errandFormDataContractErrorMessage(err, t) ?? (err instanceof Error ? err.message : String(err)));
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale, persistedSchemaId, schemaName, sourceKind, t]);

  return { schema, uiSchema, schemaId, loading, error, notFound };
}
