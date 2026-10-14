'use client';

import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { Button, FormControl, FormErrorMessage, FormLabel, Input, Modal } from '@sk-web-gui/react';
import { createStakeholderSchema, isOrganizationStakeholder, phoneNumberFormatter } from '@utils/stakeholder';
import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as yup from 'yup';

interface OwnerDetailsForm {
  address?: string;
  careOf?: string;
  zipCode?: string;
  city?: string;
  serveringsstalle?: string;
}

/**
 * An add-and-remove list, because a stakeholder may be reached on several numbers or addresses.
 * The value is validated on add, so a rejected entry never reaches the errand.
 */
const ContactList: React.FC<{
  label: string;
  placeholder: string;
  name: string;
  values: string[];
  validate: (value: string) => string | null;
  format?: (value: string) => string;
  onChange: (values: string[]) => void;
}> = ({ label, placeholder, name, values, validate, format, onChange }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const value = format ? format(draft.trim()) : draft.trim();
    const validationError = validate(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    // Silently ignoring a duplicate reads as the button not working, so it is an error too.
    if (values.includes(value)) {
      setError(t('errand-information:owner.modal.already_added'));
      return;
    }
    onChange([...values, value]);
    setDraft('');
    setError(null);
  };

  return (
    <FormControl className="w-full" invalid={error !== null}>
      <FormLabel htmlFor={`owner-${name}-input`}>{label}</FormLabel>
      <div className="flex gap-8 items-start">
        <Input
          id={`owner-${name}-input`}
          data-cy={`owner-${name}-input`}
          className="min-w-0 flex-1"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        <Button data-cy={`owner-${name}-add`} variant="secondary" leftIcon={<Plus size={16} />} onClick={add}>
          {t('errand-information:owner.modal.add')}
        </Button>
      </div>
      {error && <FormErrorMessage data-cy={`owner-${name}-error`}>{error}</FormErrorMessage>}
      <div className="flex flex-wrap gap-8 pt-8">
        {values.map((value) => (
          <span
            key={value}
            data-cy={`owner-${name}-value`}
            className="inline-flex items-center gap-4 rounded-12 border-1 px-12 py-4 text-small"
          >
            {value}
            <Button
              iconButton
              size="sm"
              variant="tertiary"
              data-cy={`owner-${name}-remove`}
              aria-label={t('errand-information:owner.modal.remove_value', { value })}
              onClick={() => {
                onChange(values.filter((candidate) => candidate !== value));
              }}
            >
              <X size={14} />
            </Button>
          </span>
        ))}
      </div>
    </FormControl>
  );
};

export const ErrandOwnerModal: React.FC<{
  owner: StakeholderDTO;
  organizationNumber?: string;
  show: boolean;
  onClose: () => void;
  onSave: (owner: StakeholderDTO) => void;
}> = ({ owner, organizationNumber, show, onClose, onSave }) => {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<string[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);

  // Rebuilt when the language changes: yup freezes the error messages at construction.
  const contactSchema = useMemo(() => createStakeholderSchema(t), [t]);

  const { register, handleSubmit, reset } = useForm<OwnerDetailsForm>();

  // Reopening after a cancel must show what was filed, not the abandoned edits.
  useEffect(() => {
    if (!show) return;
    reset({
      address: owner.address ?? '',
      careOf: owner.careOf ?? '',
      zipCode: owner.zipCode ?? '',
      city: owner.city ?? '',
      serveringsstalle: owner.serveringsstalle ?? '',
    });
    setEmails(owner.emails ?? []);
    setPhoneNumbers(owner.phoneNumbers ?? []);
  }, [show, owner, reset]);

  const validateWith = (field: 'emails' | 'phoneNumbers') => (value: string) => {
    try {
      (yup.reach(contactSchema, field) as yup.Schema).validateSync([value]);
      return null;
    } catch (error: unknown) {
      return error instanceof yup.ValidationError ? error.message : t('validation:stakeholder.email_invalid');
    }
  };

  const save = (details: OwnerDetailsForm) => {
    onSave({
      ...owner,
      ...details,
      emails: emails.length ? emails : undefined,
      phoneNumbers: phoneNumbers.length ? phoneNumbers : undefined,
    });
    onClose();
  };

  return (
    <Modal
      data-cy="errand-owner-modal"
      show={show}
      onClose={onClose}
      label={t('errand-information:owner.modal.title')}
      className="max-sm:!m-8 max-sm:!max-h-[calc(100vh-4rem)] max-sm:!w-[calc(100%-2rem)] max-sm:!overflow-y-auto"
    >
      <Modal.Content>
        {isOrganizationStakeholder(owner) ?
          <div className="flex gap-8">
            <FormControl className="min-w-0 flex-1" disabled>
              <FormLabel>{t('errand-information:owner.modal.organization_number')}</FormLabel>
              <Input data-cy="owner-organizationNumber" readOnly value={organizationNumber ?? ''} />
            </FormControl>
            <FormControl className="min-w-0 flex-1" disabled>
              <FormLabel>{t('errand-information:owner.modal.organization_name')}</FormLabel>
              <Input data-cy="owner-organizationName" readOnly value={owner.organizationName ?? ''} />
            </FormControl>
          </div>
        : <div className="flex gap-8">
            <FormControl className="min-w-0 flex-1" disabled>
              <FormLabel>{t('errand-information:owner.modal.person_number')}</FormLabel>
              <Input data-cy="owner-personNumber" readOnly value={owner.personNumber ?? ''} />
            </FormControl>
            <FormControl className="min-w-0 flex-1" disabled>
              <FormLabel>{t('errand-information:owner.modal.name')}</FormLabel>
              <Input data-cy="owner-name" readOnly value={`${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()} />
            </FormControl>
          </div>
        }

        <FormControl className="w-full">
          <FormLabel htmlFor="owner-serveringsstalle">{t('errand-information:owner.serveringsstalle')}</FormLabel>
          <Input id="owner-serveringsstalle" data-cy="owner-serveringsstalle-input" {...register('serveringsstalle')} />
        </FormControl>

        <div className="flex gap-8">
          <FormControl className="min-w-0 flex-1">
            <FormLabel htmlFor="owner-address">{t('errand-information:stakeholder.modal.address')}</FormLabel>
            <Input id="owner-address" data-cy="owner-address-input" {...register('address')} />
          </FormControl>
          <FormControl className="min-w-0 flex-1">
            <FormLabel htmlFor="owner-careOf">{t('errand-information:stakeholder.modal.care_of')}</FormLabel>
            <Input id="owner-careOf" data-cy="owner-careOf-input" {...register('careOf')} />
          </FormControl>
        </div>

        <div className="flex gap-8">
          <FormControl className="min-w-0 flex-1">
            <FormLabel htmlFor="owner-zipCode">{t('errand-information:stakeholder.modal.zip_code')}</FormLabel>
            <Input id="owner-zipCode" data-cy="owner-zipCode-input" {...register('zipCode')} />
          </FormControl>
          <FormControl className="min-w-0 flex-1">
            <FormLabel htmlFor="owner-city">{t('errand-information:stakeholder.modal.city')}</FormLabel>
            <Input id="owner-city" data-cy="owner-city-input" {...register('city')} />
          </FormControl>
        </div>

        <ContactList
          label={t('errand-information:stakeholder.phone')}
          placeholder={t('errand-information:stakeholder.phone_placeholder')}
          name="phone"
          values={phoneNumbers}
          validate={validateWith('phoneNumbers')}
          format={phoneNumberFormatter}
          onChange={setPhoneNumbers}
        />

        <ContactList
          label={t('errand-information:stakeholder.email')}
          placeholder={t('errand-information:stakeholder.email_placeholder')}
          name="email"
          values={emails}
          validate={validateWith('emails')}
          onChange={setEmails}
        />
      </Modal.Content>

      <Modal.Footer className="max-sm:flex-col max-sm:gap-8">
        <Button
          data-cy="owner-modal-save"
          variant="primary"
          className="max-sm:w-full"
          onClick={(event) => {
            void handleSubmit(save)(event);
          }}
        >
          {t('errand-information:owner.modal.save')}
        </Button>
        <Button data-cy="owner-modal-cancel" variant="secondary" className="max-sm:w-full" onClick={onClose}>
          {t('errand-information:stakeholder.modal.cancel')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
