import { StakeholderCard } from '@components/card/stakeholder-card.component';
import { useIsContentLocked } from '@contexts/errand-content-lock-context';
import { ErrandDTO, StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { yupResolver } from '@hookform/resolvers/yup';
import { getMyStakeholder, getStakeholderUsingPersonNumber } from '@services/citizen/citizen-service';
import { Button, cx, FormControl, FormErrorMessage, FormLabel, Input, SearchField, Select } from '@sk-web-gui/react';
import {
  asPersonStakeholder,
  createStakeholderSchema,
  emptyStakeholder,
  phoneNumberFormatter,
  shouldShowContactDetails,
} from '@utils/stakeholder';
import { Pen, Plus, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, Resolver, useFieldArray, useForm, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from 'src/stores/metadata-store';

import { StakeholderFormModal } from './stakeholder-modal.component';

export const StakeholderList: React.FC<{
  roles: string[];
  maxCount?: number;
  hideRoleSelect?: boolean;
  /** Offers the logged in citizen as a stakeholder, filled in from the session. */
  allowAddSelf?: boolean;
}> = ({ roles, maxCount, hideRoleSelect = false, allowAddSelf = false }) => {
  const [query, setQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<boolean>(false);
  const [emptyResult, setEmptyResult] = useState<boolean>(false);
  const [manualEntryOpen, setManualEntryOpen] = useState<boolean>(false);
  const [selfLookupFailed, setSelfLookupFailed] = useState<boolean>(false);
  const [selfExternalId, setSelfExternalId] = useState<string>();
  const { metadata } = useMetadataStore();
  const { t } = useTranslation();
  const isLocked = useIsContentLocked();

  const context = useFormContext<ErrandDTO>();
  const { stakeholders } = context.watch();

  const { append, remove } = useFieldArray({
    control: context.control,
    name: 'stakeholders',
  });

  // Rebuilt when the language changes: yup freezes the error messages at construction.
  const stakeholderSchema = useMemo(() => createStakeholderSchema(t), [t]);

  const method = useForm<StakeholderDTO>({
    defaultValues: emptyStakeholder,
    mode: 'onSubmit',
    resolver: yupResolver(stakeholderSchema) as unknown as Resolver<StakeholderDTO>,
  });

  const { handleSubmit, register, watch, reset, trigger, setValue, formState } = method;
  const { firstName, lastName, personNumber, address, city, title, department } = watch();

  //Used for resetting form when adding multiple stakeholders
  useEffect(() => {
    reset();
  }, [formState.isSubmitSuccessful]);

  const hasPrimaryStakeholder = stakeholders?.some((s) => s.role?.includes('PRIMARY'));
  const hasPrimaryRole = roles.includes('PRIMARY');
  const matchingCount = stakeholders?.filter((s) => roles.includes(s.role ?? '')).length ?? 0;
  const maxCountReached = maxCount !== undefined && matchingCount >= maxCount;
  // The search and add controls belong to editing. On a locked errand the fieldset only made
  // them unclickable, leaving a person search field and an add button that responded to nothing.
  const showAddButton =
    !isLocked && !maxCountReached && (!hasPrimaryRole || (hasPrimaryRole && !hasPrimaryStakeholder));
  const hasStakeholderWithId = (externalId: string | undefined) =>
    externalId !== undefined &&
    (stakeholders?.some((s) => roles.includes(s.role ?? '') && s.externalId === externalId) ?? false);
  const showAddSelfButton = allowAddSelf && showAddButton && !hasStakeholderWithId(selfExternalId);

  const clearStakeholderForm = () => {
    setQuery('');
    setSearchResult(false);
    setEmptyResult(false);
    reset(emptyStakeholder);
  };

  const onSearchHandler = async (query: string) => {
    setValue('personNumber', query);
    const isValid = await trigger('personNumber');
    if (!isValid) {
      return;
    }
    getStakeholderUsingPersonNumber(query)
      .then((res) => {
        if (res.status === 200) {
          reset(res.data);
          setEmptyResult(false);
          setSearchResult(true);
        } else {
          setEmptyResult(true);
        }
      })
      .catch(() => {
        setEmptyResult(true);
      });
  };

  // Added straight away: the citizen is known, contact details are edited on the card. The id
  // is only known after the lookup, so a reloaded draft is checked for a duplicate here too.
  const onAddSelfHandler = async () => {
    setSelfLookupFailed(false);
    try {
      const { data: self } = await getMyStakeholder();
      setSelfExternalId(self.externalId);
      if (!hasStakeholderWithId(self.externalId)) {
        append(asPersonStakeholder({ ...self, role: roles[0] }));
      }
    } catch {
      setSelfLookupFailed(true);
    }
  };

  const addStakeholderToErrand = (stakeholder: StakeholderDTO) => {
    if (hideRoleSelect && metadata) {
      stakeholder.role = roles[0];
    }
    append(
      asPersonStakeholder({ ...stakeholder, phoneNumbers: [phoneNumberFormatter(stakeholder?.phoneNumbers?.[0])] })
    );
    clearStakeholderForm();
  };

  return (
    <div>
      <FormProvider {...method}>
        {showAddButton && (
          <FormControl className="w-full">
            <FormLabel>{t('errand-information:search.PERSON')}</FormLabel>
            <SearchField
              data-cy="person-number-input"
              size="md"
              className="max-w-[52.5rem]"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              onSearch={(value: string) => {
                void onSearchHandler(value);
              }}
              onReset={() => {
                clearStakeholderForm();
              }}
              readOnly={searchResult}
            />
            {formState.errors.personNumber && (
              <FormErrorMessage data-cy="person-number-error">
                {formState.errors.personNumber?.message}
              </FormErrorMessage>
            )}
            {emptyResult && (
              <FormErrorMessage data-cy="empty-person-error">
                {t('errand-information:stakeholder.no_person_found')}
              </FormErrorMessage>
            )}
          </FormControl>
        )}

        {searchResult && (
          <div data-cy="search-result" className="border-1 rounded-12 bg-background-content w-max-[52.5rem] my-15">
            <div className="px-16 py-8">
              <span className="text-[1.6rem] font-semibold py-10">
                {firstName} {lastName}
              </span>

              <div className="flex text-md mb-10">
                <div className="flex flex-col">
                  {title ?
                    <span>{title}</span>
                  : <span className={cx(!personNumber && 'italic text-text-secondary')}>
                      {(personNumber ?? '') || t('errand-information:stakeholder.missing_person_number')}
                    </span>
                  }
                  {department ?
                    <span>{department}</span>
                  : <span className={cx((!address || !city) && 'italic text-text-secondary')}>
                      {/* A template literal is always truthy; show the fallback when address or city is missing */}
                      {address && city ? `${address}, ${city}` : t('errand-information:stakeholder.missing_address')}
                    </span>
                  }
                </div>
              </div>
              {shouldShowContactDetails(roles) && (
                <div className="flex flex-col sm:flex-row py-10 gap-10 w-full">
                  <FormControl className="w-full">
                    <FormLabel>{t('errand-information:stakeholder.email')}</FormLabel>
                    <Input
                      {...register('emails.0')}
                      data-cy="stakeholder-email-input"
                      placeholder={t('errand-information:stakeholder.email_placeholder')}
                    />
                    {formState.errors.emails?.[0]?.message && (
                      <FormErrorMessage data-cy="email-input-error">
                        {formState.errors.emails[0].message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                  <FormControl className="w-full">
                    <FormLabel>{t('errand-information:stakeholder.phone')}</FormLabel>
                    <Input
                      {...register('phoneNumbers.0')}
                      data-cy="stakeholder-mobilephone-input"
                      placeholder={t('errand-information:stakeholder.phone_placeholder')}
                    />
                    {formState.errors.phoneNumbers?.[0]?.message && (
                      <FormErrorMessage data-cy="phone-number-input-error">
                        {formState.errors.phoneNumbers[0].message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                </div>
              )}

              {!hideRoleSelect && (
                <FormControl required className="w-full sm:w-[calc(50%-10px)]">
                  <FormLabel>{t('errand-information:stakeholder.person_role')}</FormLabel>
                  <Select data-cy="stakeholder-role-select" className="w-full" {...register('role')}>
                    {metadata?.roles?.map(
                      (role) =>
                        roles?.includes(role.name) && (
                          <Select.Option key={role.name} value={role.name}>
                            {role.displayName}
                          </Select.Option>
                        )
                    )}
                  </Select>
                </FormControl>
              )}
              <div className="py-10">
                <Button
                  data-cy="add-stakeholder-button"
                  leftIcon={<Plus size={16} />}
                  variant="primary"
                  onClick={(e) => {
                    void handleSubmit(addStakeholderToErrand)(e);
                  }}
                  className="w-full lg:w-auto"
                >
                  {t('errand-information:stakeholder.add_person')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </FormProvider>

      {stakeholders?.map((stakeholder, index) => {
        if (!roles.includes(stakeholder.role ?? '')) return null;
        return (
          <StakeholderCard
            index={index}
            key={index}
            stakeholder={stakeholder}
            isEditable
            roles={roles}
            onRemove={() => {
              remove(index);
            }}
          />
        );
      })}

      {showAddButton && (
        <div className="mt-6 flex flex-col gap-8">
          <div className="flex flex-wrap gap-8">
            <Button
              data-cy="add-manual-person-button"
              variant="primary"
              size="sm"
              color="vattjom"
              inverted={true}
              className="w-fit"
              leftIcon={<Pen />}
              onClick={() => {
                setManualEntryOpen(true);
              }}
            >
              {t('errand-information:stakeholder.add_manually')}
            </Button>
            {showAddSelfButton && (
              <Button
                data-cy="add-self-button"
                variant="primary"
                size="sm"
                color="vattjom"
                inverted={true}
                className="w-fit"
                leftIcon={<UserRound />}
                onClick={() => {
                  void onAddSelfHandler();
                }}
              >
                {t('errand-information:stakeholder.add_self')}
              </Button>
            )}
          </div>
          {selfLookupFailed && (
            <FormErrorMessage data-cy="add-self-error">
              {t('errand-information:stakeholder.self_lookup_failed')}
            </FormErrorMessage>
          )}
        </div>
      )}

      <StakeholderFormModal
        roles={roles}
        show={manualEntryOpen}
        onClose={() => {
          setManualEntryOpen(false);
        }}
        editableFields={
          roles.includes('SUBSTITUTEASSIGNMENT') ?
            ['personNumber', 'firstName', 'lastName', 'emails', 'phoneNumbers', 'role']
          : ['personNumber', 'firstName', 'lastName', 'emails', 'phoneNumbers']
        }
      />
    </div>
  );
};
