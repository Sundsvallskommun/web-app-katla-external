import { ErrandDTO, StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { yupResolver } from '@hookform/resolvers/yup';
import { Button, FormControl, FormErrorMessage, FormLabel, Input, Modal, Select } from '@sk-web-gui/react';
import {
  asPersonStakeholder,
  createStakeholderSchema,
  phoneNumberFormatter,
  shouldShowContactDetails,
} from '@utils/stakeholder';
import { useEffect, useMemo } from 'react';
import { Resolver, useFieldArray, useForm, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from 'src/stores/metadata-store';
import * as yup from 'yup';

export const StakeholderFormModal: React.FC<{
  index?: number;
  onClose: () => void;
  show: boolean;
  roles: string[];
  initialValues?: StakeholderDTO;
  edit?: boolean;
  editableFields?: (keyof StakeholderDTO)[];
}> = ({ index, onClose, show, roles, edit, initialValues, editableFields }) => {
  const { t } = useTranslation();
  const showField = (field: keyof StakeholderDTO) => !editableFields || editableFields.includes(field);
  const { metadata } = useMetadataStore();
  const context = useFormContext<ErrandDTO>();

  const { update, append } = useFieldArray({
    control: context.control,
    name: 'stakeholders',
  });

  const schema = useMemo(() => {
    // Rebuilt when the language changes: yup freezes the error messages at construction.
    const stakeholderSchema = createStakeholderSchema(t);
    if (!editableFields) return stakeholderSchema;
    const fields: Record<string, yup.Schema> = {};
    const fullSchema = stakeholderSchema.describe().fields;
    for (const field of editableFields) {
      if (field in fullSchema) {
        fields[field] = yup.reach(stakeholderSchema, field) as yup.Schema;
      }
    }
    return yup.object(fields);
  }, [editableFields, t]);

  const method = useForm<StakeholderDTO>({
    mode: 'onSubmit',
    resolver: yupResolver(schema) as unknown as Resolver<StakeholderDTO>,
  });

  const { handleSubmit, register, reset, formState } = method;

  useEffect(() => {
    reset(initialValues);
  }, [onClose]);

  const onSave = (data: StakeholderDTO) => {
    const merged = editableFields ? { ...initialValues, ...data } : data;
    const stakeholder: StakeholderDTO = { ...merged, phoneNumbers: [phoneNumberFormatter(merged?.phoneNumbers?.[0])] };
    if (!editableFields?.includes('role') && !stakeholder.role) {
      stakeholder.role = roles.length === 1 ? roles[0] : undefined;
    }
    if (edit && index !== undefined) {
      update(index, stakeholder);
    } else {
      append(asPersonStakeholder(stakeholder));
    }
    onClose();
  };

  return (
    <Modal
      data-cy="manual-person-modal"
      show={show}
      onClose={onClose}
      label={
        edit ?
          t('errand-information:stakeholder.modal.edit_title')
        : t('errand-information:stakeholder.modal.add_title')
      }
      className="max-sm:!m-8 max-sm:!max-h-[calc(100vh-4rem)] max-sm:!w-[calc(100%-2rem)] max-sm:!max-w-full max-sm:!overflow-y-auto !overflow-x-hidden"
    >
      <Modal.Content>
        {(showField('firstName') || showField('lastName')) && (
          <div className="flex gap-8">
            {showField('firstName') && (
              <FormControl required className="min-w-0 flex-1">
                <FormLabel>{t('errand-information:stakeholder.modal.first_name')}</FormLabel>
                <Input data-cy="modal-firstName-input" {...register(`firstName`)} />
                {formState.errors.firstName && (
                  <FormErrorMessage data-cy="firstName-input-error">
                    {formState.errors.firstName.message}
                  </FormErrorMessage>
                )}
              </FormControl>
            )}
            {showField('lastName') && (
              <FormControl required className="min-w-0 flex-1">
                <FormLabel>{t('errand-information:stakeholder.modal.last_name')}</FormLabel>
                <Input data-cy="modal-lastName-input" {...register(`lastName`)} />
                {formState.errors.lastName && (
                  <FormErrorMessage data-cy="lastName-input-error">
                    {formState.errors.lastName.message}
                  </FormErrorMessage>
                )}
              </FormControl>
            )}
          </div>
        )}

        {shouldShowContactDetails(roles) && (
          <>
            {(showField('emails') || showField('phoneNumbers')) && (
              <div className="flex gap-8">
                {showField('emails') && (
                  <FormControl className="min-w-0 flex-1">
                    <FormLabel>{t('errand-information:stakeholder.email')}</FormLabel>
                    <Input data-cy="modal-email-input" {...register('emails.0')} />
                    {formState.errors.emails?.[0]?.message && (
                      <FormErrorMessage data-cy="modal-email-input-error">
                        {formState.errors.emails[0].message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                )}
                {showField('phoneNumbers') && (
                  <FormControl className="min-w-0 flex-1">
                    <FormLabel>{t('errand-information:stakeholder.phone')}</FormLabel>
                    <Input data-cy="modal-phone-input" {...register('phoneNumbers.0')} />
                    {formState.errors.phoneNumbers?.[0]?.message && (
                      <FormErrorMessage data-cy="modal-phone-input-error" className="truncate">
                        {formState.errors.phoneNumbers[0].message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                )}
              </div>
            )}

            {(showField('address') || showField('careOf')) && (
              <div className="flex gap-8">
                {showField('address') && (
                  <FormControl className="min-w-0 flex-1">
                    <FormLabel>{t('errand-information:stakeholder.modal.address')}</FormLabel>
                    <Input data-cy="modal-address-input" {...register(`address`)} />
                  </FormControl>
                )}
                {showField('careOf') && (
                  <FormControl className="min-w-0 flex-1">
                    <FormLabel>{t('errand-information:stakeholder.modal.care_of')}</FormLabel>
                    <Input data-cy="modal-careOf-input" {...register(`careOf`)} />
                  </FormControl>
                )}
              </div>
            )}

            {(showField('zipCode') || showField('city')) && (
              <div className="flex gap-8">
                {showField('zipCode') && (
                  <FormControl className="min-w-0 flex-1">
                    <FormLabel>{t('errand-information:stakeholder.modal.zip_code')}</FormLabel>
                    <Input data-cy="modal-zipCode-input" {...register(`zipCode`)} />
                  </FormControl>
                )}
                {showField('city') && (
                  <FormControl className="min-w-0 flex-1">
                    <FormLabel>{t('errand-information:stakeholder.modal.city')}</FormLabel>
                    <Input data-cy="modal-city-input" {...register(`city`)} />
                  </FormControl>
                )}
              </div>
            )}
          </>
        )}

        {showField('role') && (
          <FormControl required className="w-full">
            <FormLabel>{t('errand-information:stakeholder.modal.role')}</FormLabel>
            <Select data-cy="modal-stakeholder-role-select" className="w-full" {...register(`role`)}>
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
      </Modal.Content>

      <Modal.Footer className="max-sm:flex-col max-sm:gap-8">
        <Button
          data-cy="modal-add-person-button"
          variant="primary"
          onClick={(e) => {
            void handleSubmit(onSave)(e);
          }}
          className="max-sm:w-full"
        >
          {edit ?
            t('errand-information:stakeholder.modal.save_edit')
          : t('errand-information:stakeholder.modal.save_add')}
        </Button>
        <Button data-cy="modal-cancel-person-button" variant="secondary" onClick={onClose} className="max-sm:w-full">
          {t('errand-information:stakeholder.modal.cancel')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
