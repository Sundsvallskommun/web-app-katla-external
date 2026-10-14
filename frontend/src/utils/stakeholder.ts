import { OrganizationDTO, RoleDTO, StakeholderDTO } from '@data-contracts/backend/data-contracts';
import type { TFunction } from 'i18next';
import { appConfig } from 'src/config/appconfig';
import * as yup from 'yup';

export const PRIMARY_STAKEHOLDER_ROLE = 'PRIMARY';

/** SupportManagement's externalIdType for an organisation, as opposed to a private person. */
export const ORGANIZATION_EXTERNAL_ID_TYPE = 'COMPANY';
/** SupportManagement's externalIdType for a private person. */
export const PERSON_EXTERNAL_ID_TYPE = 'PRIVATE';

/** Every non-owner stakeholder this app files is a private person, however they were added. */
export const asPersonStakeholder = (stakeholder: StakeholderDTO): StakeholderDTO => ({
  ...stakeholder,
  externalIdType: PERSON_EXTERNAL_ID_TYPE,
});

export const isOrganizationStakeholder = (stakeholder: StakeholderDTO): boolean =>
  stakeholder.externalIdType === ORGANIZATION_EXTERNAL_ID_TYPE;

export const shouldShowContactDetails = (roles?: string[]) =>
  !(roles?.includes(PRIMARY_STAKEHOLDER_ROLE) && appConfig.features.reducedStakeholderInfo);

/** The errand owner: the organisation or private person the errand is registered for. */
export const getPrimaryStakeholder: (stakeholders: StakeholderDTO[] | undefined) => StakeholderDTO | undefined = (
  stakeholders
) => stakeholders?.find((s) => s.role === PRIMARY_STAKEHOLDER_ROLE);

// externalId must carry the LegalEntity party id: it is the field the backend scopes errands by,
// so an owner written any other way makes the errand unreadable to the citizen who filed it.
export const organizationAsPrimaryStakeholder = (organization: OrganizationDTO): StakeholderDTO => ({
  role: PRIMARY_STAKEHOLDER_ROLE,
  externalId: organization.partyId,
  externalIdType: ORGANIZATION_EXTERNAL_ID_TYPE,
  organizationName: organization.organizationName,
});

/** The logged in citizen as owner: a private applicant. externalId is their party id, as above. */
export const citizenAsPrimaryStakeholder = (self: StakeholderDTO): StakeholderDTO => ({
  ...self,
  role: PRIMARY_STAKEHOLDER_ROLE,
  externalIdType: PERSON_EXTERNAL_ID_TYPE,
});

/** Drops the errand owner, leaving the other stakeholders untouched. */
export const withoutPrimaryStakeholder = (stakeholders: StakeholderDTO[] | undefined): StakeholderDTO[] =>
  (stakeholders ?? []).filter((s) => s.role !== PRIMARY_STAKEHOLDER_ROLE);

/** Sets the errand owner, leaving the other stakeholders untouched. An errand has one owner. */
export const withPrimaryStakeholder = (
  stakeholders: StakeholderDTO[] | undefined,
  owner: StakeholderDTO
): StakeholderDTO[] => [...withoutPrimaryStakeholder(stakeholders), owner];

export const emptyStakeholder: StakeholderDTO = {
  externalIdType: PERSON_EXTERNAL_ID_TYPE,
  externalId: '',
  personNumber: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  emails: [''],
  zipCode: '',
  phoneNumbers: [''],
  role: '',
};

const personNumberRegex = /^\d{8}-?\d{4}$/;
const phoneRegExp = /^$|^(?:\+|0)[0-9\s-]{6,19}$/;
const emailRegExp =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function phoneNumberFormatter(phoneNumber: string | undefined | null): string {
  if (!phoneNumber) return '';

  let formatted = phoneNumber.trim().replaceAll('-', '').replaceAll(' ', '');

  formatted = formatted.replace(/^0{3,}/, '00');

  if (formatted.startsWith('00')) {
    return formatted.replace(/^00/, '+');
  }

  if (formatted.startsWith('0')) {
    return formatted.replace(/^0/, '+46');
  }

  return formatted;
}

/**
 * A factory rather than a ready-made schema: yup binds the error messages when the schema is
 * built, so a module-level schema would pin the language to whatever applied at import time.
 * Called through useMemo on the active language.
 */
export const createStakeholderSchema = (t: TFunction) =>
  yup.object({
    firstName: yup.string().trim().required(t('validation:stakeholder.first_name_required')),
    lastName: yup.string().trim().required(t('validation:stakeholder.last_name_required')),
    personNumber: yup
      .string()
      .nullable()
      .notRequired()
      .matches(personNumberRegex, {
        message: t('validation:stakeholder.person_number_format'),
        excludeEmptyString: true,
      })
      .test('valid-date', t('validation:stakeholder.person_number_invalid_date'), (value) => {
        if (!value) return true;
        const normalized = value.replace('-', '');

        const year = Number(normalized.slice(0, 4));
        const month = Number(normalized.slice(4, 6)) - 1;
        const day = Number(normalized.slice(6, 8));

        const date = new Date(year, month, day);
        return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
      }),
    emails: yup
      .array()
      .of(
        yup.string().matches(emailRegExp, {
          message: t('validation:stakeholder.email_invalid'),
          excludeEmptyString: true,
        })
      )
      .notRequired(),
    phoneNumbers: yup
      .array()
      .of(yup.string().matches(phoneRegExp, t('validation:stakeholder.phone_invalid')).nullable().optional())
      .notRequired(),
  });

export type StakeholderSchema = ReturnType<typeof createStakeholderSchema>;

export const getReporterStakeholder: (stakeholders: StakeholderDTO[] | undefined) => StakeholderDTO | undefined = (
  stakeholders
) => stakeholders?.find((s) => s.role?.includes('REPORTER'));

export const getStakeholderRoleDisplayName: (stakeholder: StakeholderDTO, roles: RoleDTO[] | undefined) => string = (
  stakeholder,
  role
) => {
  return role?.find((role) => role?.name === stakeholder?.role)?.displayName ?? '';
};
