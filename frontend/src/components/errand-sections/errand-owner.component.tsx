'use client';

import { StakeholderCard } from '@components/card/stakeholder-card.component';
import { ErrandDisclosure } from '@components/disclosure/errand-information-disclosure.component';
import { ErrandOwnerModal } from '@components/errand-sections/errand-owner-modal.component';
import { ErrorAlert } from '@components/misc/error-alert.component';
import { useIsContentLocked } from '@contexts/errand-content-lock-context';
import { useFormValidation } from '@contexts/form-validation-context';
import { OrganizationDTO, StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { getMyStakeholder } from '@services/citizen/citizen-service';
import { getOwnerStakeholder } from '@services/organization-service/organization-service';
import { Button, FormControl, FormErrorMessage, FormLabel, Select, Spinner } from '@sk-web-gui/react';
import { INVALID_FIELD_ATTRIBUTE } from '@utils/focus-first-error';
import {
  citizenAsPrimaryStakeholder,
  getPrimaryStakeholder,
  isOrganizationStakeholder,
  organizationAsPrimaryStakeholder,
  PRIMARY_STAKEHOLDER_ROLE,
  withoutPrimaryStakeholder,
  withPrimaryStakeholder,
} from '@utils/stakeholder';
import { Building2, UserRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMyOrganizations } from 'src/hooks/use-my-organizations';

const OWNER_FIELD_ID = 'errand-owner';

export const ErrandOwnerContent: React.FC = () => {
  const { t } = useTranslation();
  const { organizations, organizationsError, organizationsLoadState } = useMyOrganizations();
  const { showValidation } = useFormValidation();
  const isLocked = useIsContentLocked();
  const { getValues, setValue, watch } = useFormContext<ErrandFormDTO>();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selfLookupFailed, setSelfLookupFailed] = useState(false);

  const stakeholders = watch('stakeholders');
  const owner = getPrimaryStakeholder(stakeholders);
  const ownerIsPerson = owner !== undefined && !isOrganizationStakeholder(owner);
  const selectedPartyId = owner?.externalId;
  // Owners filed before the number was written carry none.
  const selectedOrganization = organizations.find((organization) => organization.partyId === selectedPartyId);
  const organizationNumber = owner?.organizationNumber ?? selectedOrganization?.organizationNumber;

  const loadOwnerDetails = useCallback(
    (partyId: string) =>
      getOwnerStakeholder(partyId)
        .then((details) => {
          const current = getValues('stakeholders');
          const currentOwner = getPrimaryStakeholder(current);
          if (currentOwner?.externalId !== partyId) return;
          setValue('stakeholders', [...withoutPrimaryStakeholder(current), { ...details, ...currentOwner }], {
            shouldDirty: true,
          });
        })
        .catch(() => undefined),
    [getValues, setValue]
  );

  const selectOrganization = (organization: OrganizationDTO) => {
    setValue(
      'stakeholders',
      withPrimaryStakeholder(getValues('stakeholders'), organizationAsPrimaryStakeholder(organization)),
      {
        shouldDirty: true,
      }
    );
    void loadOwnerDetails(organization.partyId);
  };

  const selectPartyId = (partyId: string) => {
    const organization = organizations.find((candidate) => candidate.partyId === partyId);

    if (organization) selectOrganization(organization);
    else setValue('stakeholders', withoutPrimaryStakeholder(stakeholders), { shouldDirty: true });
  };

  const addSelf = async () => {
    setSelfLookupFailed(false);
    try {
      const { data: self } = await getMyStakeholder();
      setValue('stakeholders', withPrimaryStakeholder(getValues('stakeholders'), citizenAsPrimaryStakeholder(self)), {
        shouldDirty: true,
      });
    } catch {
      setSelfLookupFailed(true);
    }
  };

  const replaceOwner = (updated: StakeholderDTO) => {
    setValue('stakeholders', [...withoutPrimaryStakeholder(stakeholders), updated], { shouldDirty: true });
  };

  const hasError = showValidation && owner === undefined;
  const invalidFieldProps = hasError ? { [INVALID_FIELD_ATTRIBUTE]: OWNER_FIELD_ID } : {};
  const showSelect = !isLocked && !ownerIsPerson && organizations.length > 0;
  const showAddSelf = !isLocked && owner === undefined;

  return (
    <div className="flex flex-col gap-[2.4rem] pb-[2.4rem]">
      <span className="text-dark-secondary">{t('errand-information:owner.description')}</span>

      {organizationsLoadState === 'loading' && <Spinner aria-label={t('forms:loading')} />}

      {organizationsError && <ErrorAlert message={organizationsError} />}

      {organizationsLoadState === 'ready' && (
        <div>
          {showSelect && (
            <FormControl required invalid={hasError} className="w-full sm:w-[calc(50%-10px)]" {...invalidFieldProps}>
              <FormLabel htmlFor={OWNER_FIELD_ID}>{t('errand-information:owner.select_label')}</FormLabel>
              <Select
                id={OWNER_FIELD_ID}
                data-cy="errand-owner-select"
                className="w-full"
                value={selectedPartyId ?? ''}
                aria-invalid={hasError}
                onChange={(event) => {
                  selectPartyId(event.target.value);
                }}
              >
                <Select.Option value="">{t('errand-information:owner.select_placeholder')}</Select.Option>
                {organizations.map((organization) => (
                  <Select.Option key={organization.partyId} value={organization.partyId}>
                    {organization.organizationName}
                  </Select.Option>
                ))}
              </Select>
              {hasError && (
                <FormErrorMessage data-cy="errand-owner-error" className="text-error">
                  {t('validation:owner.required')}
                </FormErrorMessage>
              )}
            </FormControl>
          )}

          {!isLocked && organizations.length === 0 && (
            <span data-cy="no-organizations" className="text-dark-secondary">
              {t('errand-information:owner.no_organizations')}
            </span>
          )}

          {showAddSelf && (
            <div className="mt-16 flex flex-col gap-8" {...(showSelect ? {} : invalidFieldProps)}>
              <Button
                data-cy="add-self-owner-button"
                variant="primary"
                size="sm"
                color="vattjom"
                inverted={true}
                className="w-fit"
                leftIcon={<UserRound />}
                onClick={() => {
                  void addSelf();
                }}
              >
                {t('errand-information:stakeholder.add_self')}
              </Button>
              {selfLookupFailed && (
                <FormErrorMessage data-cy="add-self-owner-error">
                  {t('errand-information:owner.self_lookup_failed')}
                </FormErrorMessage>
              )}
              {hasError && !showSelect && (
                <FormErrorMessage data-cy="errand-owner-error" className="text-error">
                  {t('validation:owner.required')}
                </FormErrorMessage>
              )}
            </div>
          )}

          {owner && (
            <>
              <StakeholderCard
                stakeholder={owner}
                roles={[PRIMARY_STAKEHOLDER_ROLE]}
                organizationNumber={organizationNumber}
                roleLabel={t('errand-information:owner.role_label')}
                headerActions={
                  <>
                    <Button
                      data-cy="edit-owner-button"
                      variant="link"
                      onClick={() => {
                        setIsEditOpen(true);
                      }}
                    >
                      {t('errand-information:stakeholder.edit_details')}
                    </Button>
                    <Button
                      data-cy="remove-owner-button"
                      variant="link"
                      onClick={() => {
                        selectPartyId('');
                      }}
                    >
                      {t('errand-information:stakeholder.remove')}
                    </Button>
                  </>
                }
              />
              <ErrandOwnerModal
                owner={owner}
                organizationNumber={organizationNumber}
                show={isEditOpen}
                onClose={() => {
                  setIsEditOpen(false);
                }}
                onSave={replaceOwner}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const ErrandOwner: React.FC = () => {
  const { t } = useTranslation();

  return (
    <ErrandDisclosure header={t('errand-information:owner.title')} icon={<Building2 />}>
      <ErrandOwnerContent />
    </ErrandDisclosure>
  );
};
