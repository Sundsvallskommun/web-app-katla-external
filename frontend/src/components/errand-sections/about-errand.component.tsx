'use client';

import { ErrandDisclosure } from '@components/disclosure/errand-information-disclosure.component';
import { useIsContentLocked } from '@contexts/errand-content-lock-context';
import { useFormValidation } from '@contexts/form-validation-context';
import { LabelDTO } from '@data-contracts/backend/data-contracts';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { Combobox, CustomOnChangeEvent, FormControl, FormErrorMessage, FormLabel, Select } from '@sk-web-gui/react';
import { INVALID_FIELD_ATTRIBUTE } from '@utils/focus-first-error';
import {
  byDisplayName,
  getSelectableLabels,
  getSelectableTypesForCategory,
  getSelectedLabels,
  toErrandLabels,
} from '@utils/label-tree';
import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from 'src/stores/metadata-store';

const CATEGORY_FIELD_ID = 'errand-category';
const TYPE_FIELD_ID = 'errand-type';

/** The combobox emits a subtype id, or a leaf type's own id. */
const selectedId = (event: CustomOnChangeEvent): string =>
  Array.isArray(event.target.value) ? (event.target.value[0] ?? '') : event.target.value;

export const AboutErrandContent: React.FC = () => {
  const { t } = useTranslation();
  const { setValue, watch } = useFormContext<ErrandFormDTO>();
  const { showValidation } = useFormValidation();
  const isLocked = useIsContentLocked();
  const labelStructure = useMetadataStore((state) => state.metadata?.labels?.labelStructure);

  const selected = getSelectedLabels(watch('labels'));

  const categories = useMemo(() => [...(labelStructure ?? [])].sort(byDisplayName), [labelStructure]);
  // Unfiltered: a deprecated category must still resolve to its types.
  const selectedCategory = categories.find((category) => category.id === selected.CATEGORY?.id);

  const selectableCategories = getSelectableLabels(categories, [selected.CATEGORY?.id]);
  const selectableTypes = getSelectableTypesForCategory(selectedCategory, [
    selected.TYPE?.id,
    selected.SUBTYPE?.id,
  ]).sort(byDisplayName);

  const selectCategory = (id: string) => {
    const category = categories.find((candidate) => candidate.id === id);
    setValue('labels', category ? toErrandLabels(category) : [], { shouldDirty: true });
  };

  const selectType = (id: string) => {
    if (!selectedCategory) return;

    const leafType = selectableTypes.find((type) => type.id === id);
    if (leafType) {
      setValue('labels', toErrandLabels(selectedCategory, leafType), { shouldDirty: true });
      return;
    }

    for (const type of selectableTypes) {
      const subtype = type.labels?.find((candidate) => candidate.id === id);
      if (subtype) {
        setValue('labels', toErrandLabels(selectedCategory, type, subtype), { shouldDirty: true });
        return;
      }
    }
  };

  const categoryHasError = showValidation && !selected.CATEGORY;
  const typeHasError = showValidation && !!selected.CATEGORY && !selected.TYPE;

  if (isLocked) {
    return (
      <dl data-cy="errand-categorization-summary" className="flex flex-col gap-[2.4rem] pb-[2.4rem]">
        <div>
          <dt className="font-bold">{t('errand-information:about.category_label')}</dt>
          <dd>{selected.CATEGORY?.displayName ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-bold">{t('errand-information:about.type_label')}</dt>
          <dd>{(selected.SUBTYPE ?? selected.TYPE)?.displayName ?? '—'}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="flex flex-col gap-[2.4rem] pb-[2.4rem]">
      <span className="text-dark-secondary">{t('errand-information:about.description')}</span>
      <FormControl
        required
        invalid={categoryHasError}
        className="w-full sm:w-[calc(50%-10px)]"
        {...(categoryHasError ? { [INVALID_FIELD_ATTRIBUTE]: CATEGORY_FIELD_ID } : {})}
      >
        <FormLabel htmlFor={CATEGORY_FIELD_ID}>{t('errand-information:about.category_label')}</FormLabel>
        <Select
          id={CATEGORY_FIELD_ID}
          data-cy="errand-category-select"
          className="w-full"
          value={selected.CATEGORY?.id ?? ''}
          aria-invalid={categoryHasError}
          onChange={(event) => {
            selectCategory(event.target.value);
          }}
        >
          <Select.Option value="">{t('errand-information:about.category_placeholder')}</Select.Option>
          {selectableCategories.map((category) => (
            <Select.Option key={category.id} value={category.id}>
              {category.displayName}
            </Select.Option>
          ))}
        </Select>
        {categoryHasError && (
          <FormErrorMessage data-cy="errand-category-error" className="text-error">
            {t('validation:categorization.category_required')}
          </FormErrorMessage>
        )}
      </FormControl>

      <FormControl
        required
        invalid={typeHasError}
        className="w-full sm:w-[calc(80%-10px)]"
        {...(typeHasError ? { [INVALID_FIELD_ATTRIBUTE]: TYPE_FIELD_ID } : {})}
      >
        <FormLabel htmlFor={TYPE_FIELD_ID}>{t('errand-information:about.type_label')}</FormLabel>
        <Combobox
          data-cy="errand-type-combobox"
          className="w-full"
          disabled={!selectedCategory}
          placeholder={
            selectedCategory ?
              t('errand-information:about.type_placeholder')
            : t('errand-information:about.type_placeholder_no_category')
          }
          searchPlaceholder={t('errand-information:about.type_search_placeholder')}
          value={selected.SUBTYPE?.id ?? selected.TYPE?.id ?? ''}
          onSelect={(event) => {
            selectType(selectedId(event));
          }}
        >
          {/* The root's disabled only governs the popup; the input needs its own. */}
          <Combobox.Input
            id={TYPE_FIELD_ID}
            data-cy="errand-type-input"
            className="w-full"
            disabled={!selectedCategory}
          />
          <Combobox.List data-cy="errand-type-list">
            {selectableTypes.map((type) =>
              (type.labels?.length ?? 0) > 0 ?
                <Combobox.Optgroup key={type.id} label={type.displayName}>
                  {[...(type.labels ?? [])].sort(byDisplayName).map((subtype: LabelDTO) => (
                    <Combobox.Option key={subtype.id} value={subtype.id ?? ''}>
                      {subtype.displayName ?? subtype.resourceName}
                    </Combobox.Option>
                  ))}
                </Combobox.Optgroup>
              : <Combobox.Option key={type.id} value={type.id ?? ''}>
                  {type.displayName ?? type.resourceName}
                </Combobox.Option>
            )}
          </Combobox.List>
        </Combobox>
        {typeHasError && (
          <FormErrorMessage data-cy="errand-type-error" className="text-error">
            {t('validation:categorization.type_required')}
          </FormErrorMessage>
        )}
      </FormControl>
    </div>
  );
};

export const AboutErrand: React.FC = () => {
  const { t } = useTranslation();

  return (
    <ErrandDisclosure header={t('errand-information:about.title')} icon={<Info />}>
      <AboutErrandContent />
    </ErrandDisclosure>
  );
};
