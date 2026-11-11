import { ContactChannel, Parameter, Stakeholder } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { StakeholderDTO } from '@/responses/supportmanagement.response';

/** Parameter key for the serving location. */
const SERVERINGSSTALLE_PARAMETER = 'serveringsstalle';
/** Parameter key Draken reads the organisation number from. */
export const ORGANIZATION_NUMBER_PARAMETER = 'organizationNumber';
/** Contact channel types as Draken writes them; read case-insensitively since older errands hold lowercase. */
export const EMAIL_CHANNEL = 'EMAIL';
export const PHONE_CHANNEL = 'PHONE';

/** Draken's format: NNNNNN-NNNN. */
export const formatOrganizationNumber = (organizationNumber: string): string => {
  const digits = organizationNumber.replace(/\D/g, '');

  return digits.length === 10 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : organizationNumber;
};

export const organizationNumberParameter = (organizationNumber: string): Parameter => ({
  key: ORGANIZATION_NUMBER_PARAMETER,
  displayName: 'Organisationsnummer',
  values: [formatOrganizationNumber(organizationNumber)],
});

export function mapStakeholderToStakeholderDTO(stakeholder: Stakeholder): StakeholderDTO {
  const { contactChannels, parameters, ...rest } = stakeholder;

  const { emails, phoneNumbers } = (contactChannels ?? []).reduce<{
    emails: string[];
    phoneNumbers: string[];
  }>(
    (acc, { type, value }) => {
      if (!value) return acc;

      if (type?.toUpperCase() === EMAIL_CHANNEL) acc.emails.push(value.toLocaleLowerCase());
      if (type?.toUpperCase() === PHONE_CHANNEL) acc.phoneNumbers.push(value);

      return acc;
    },
    { emails: [], phoneNumbers: [] },
  );

  return {
    ...rest,
    title: parameters?.find(p => p.key === 'title')?.displayName ?? undefined,
    department: parameters?.find(p => p.key === 'department')?.displayName ?? undefined,
    // values, not displayName: this one carries data the citizen entered, not a label.
    serveringsstalle: parameters?.find(p => p.key === SERVERINGSSTALLE_PARAMETER)?.values?.[0] ?? undefined,
    organizationNumber: parameters?.find(p => p.key === ORGANIZATION_NUMBER_PARAMETER)?.values?.[0] ?? undefined,
    emails: emails.length ? emails : undefined,
    phoneNumbers: phoneNumbers.length ? phoneNumbers : undefined,
  };
}

export function mapStakeholderDTOToStakeholder(stakeholder: StakeholderDTO): Stakeholder {
  delete stakeholder.personNumber;
  const { emails, phoneNumbers, title, department, serveringsstalle, organizationNumber, ...rest } = stakeholder;

  const contactChannels: ContactChannel[] = [
    ...(emails?.map(email => ({
      type: EMAIL_CHANNEL,
      value: email,
    })) ?? []),

    ...(phoneNumbers?.map(phone => ({
      type: PHONE_CHANNEL,
      value: phone,
    })) ?? []),
  ];

  const parameters: Parameter[] = [];
  if (title) {
    parameters.push({
      key: 'title',
      displayName: title,
    });
  }
  if (department) {
    parameters.push({
      key: 'department',
      displayName: department,
    });
  }
  if (serveringsstalle) {
    parameters.push({
      key: SERVERINGSSTALLE_PARAMETER,
      values: [serveringsstalle],
    });
  }
  // The owner's number comes from the session (primary-stakeholder.ts), never from the client.
  if (organizationNumber && stakeholder.role !== 'PRIMARY') {
    parameters.push(organizationNumberParameter(organizationNumber));
  }

  return {
    ...rest,
    contactChannels: contactChannels.length ? contactChannels : undefined,
    parameters,
  };
}

export function addHyphenToPersonNumber(personNumber: string): string {
  if (!personNumber) return personNumber;

  const digitsOnly = personNumber.replace(/\D/g, '');

  if (digitsOnly.length !== 12) return personNumber;

  return `${digitsOnly.slice(0, 8)}-${digitsOnly.slice(8)}`;
}
