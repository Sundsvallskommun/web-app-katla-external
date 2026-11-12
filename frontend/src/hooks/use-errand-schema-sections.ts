import i18nConfig from '@app/i18nConfig';
import { type SchemaSection, schemaSectionsOf } from '@components/json/utils/schema-sections';
import { loadFormSchema, loadFormSchemaForEntry, schemaNamesForErrand } from '@components/json/utils/schema-utils';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from 'src/stores/metadata-store';

const NO_SECTIONS: SchemaSection[] = [];

interface ErrandSchemaSections {
  sections: SchemaSection[];
  /** The sections of the current errand type are not known yet. */
  loading: boolean;
}

/**
 * The `ui:sections` of the errand type's form, read from the same schema version the form renders:
 * the saved one for an answered form, the latest otherwise. A form that cannot be loaded has no
 * sections; the form step itself shows why.
 */
export function useErrandSchemaSections(): ErrandSchemaSections {
  const { getValues, watch } = useFormContext<ErrandFormDTO>();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18nConfig.defaultLocale;
  const namespace = useMetadataStore((state) => state.metadata?.namespace);
  // The answers change on every keystroke; the sections only with the errand type and language.
  const schemaNames = schemaNamesForErrand(watch('labels'), namespace).join(',');
  const key = `${locale}|${schemaNames}`;
  const [resolved, setResolved] = useState<{ key: string; sections: SchemaSection[] }>({ key: '', sections: [] });

  useEffect(() => {
    let active = true;

    void Promise.all(
      schemaNames
        .split(',')
        .filter(Boolean)
        .map(async (schemaName) => {
          const entry = getValues('errandFormData')?.find((candidate) => candidate.schemaName === schemaName);
          try {
            const { schema, uiSchema } =
              entry?.schemaId ?
                await loadFormSchemaForEntry(schemaName, entry.schemaId, undefined, locale)
              : await loadFormSchema(schemaName, undefined, locale);
            return schemaSectionsOf(schemaName, schema, uiSchema);
          } catch {
            return [];
          }
        })
    ).then((perSchema) => {
      if (active) setResolved({ key, sections: perSchema.flat() });
    });

    return () => {
      active = false;
    };
  }, [getValues, key, locale, schemaNames]);

  // Until the new type's sections arrive, the previous type's would be wrong, so none are offered.
  return resolved.key === key ?
      { sections: resolved.sections, loading: false }
    : { sections: NO_SECTIONS, loading: true };
}
