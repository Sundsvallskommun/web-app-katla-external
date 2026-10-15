import type { StakeholderDTO } from '@data-contracts/backend/data-contracts';

import { MOCK_COUNTRY_CODE_PHONE_NUMBER, MOCK_EMAIL, MOCK_HYPHEN_PERSON_NUMBER } from '../utils/constants';

export const mockReporterStakeholder: StakeholderDTO = {
  externalId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  city: '',
  firstName: 'Test',
  lastName: 'Testsson',
  address: '',
  zipCode: '',
  emails: [MOCK_EMAIL],
  phoneNumbers: [MOCK_COUNTRY_CODE_PHONE_NUMBER],
  role: 'REPORTER',
  title: 'mockTitle',
  department: 'mockDepartment',
};

export const mockStakeholder: StakeholderDTO = {
  personNumber: MOCK_HYPHEN_PERSON_NUMBER,
  externalId: 'aaaaaaaa-ffff-cccc-dddd-eeeeeeeeeeee',
  city: 'mockCity',
  firstName: 'Mock',
  lastName: 'Person',
  address: 'mockAddress 1',
  zipCode: '12345',
  careOf: '',
};

export const mockManualEditStakeholder: StakeholderDTO = {
  externalId: 'aaaaaaaa-ffff-gggg-dddd-eeeeeeeeeeee',
  city: 'mockEditCity',
  firstName: 'TestFirstName',
  lastName: 'TestLastName',
  address: 'mockAddress 2',
  zipCode: '12346',
  careOf: 'mockEditCareOf',
};

/** The logged in citizen, as /citizen/me hands them back. The name matches the getMe fixture. */
export const mockSelfStakeholder: StakeholderDTO = {
  personNumber: MOCK_HYPHEN_PERSON_NUMBER,
  externalId: 'aaaaaaaa-0000-4000-8000-000000000001',
  city: 'Sundsvall',
  firstName: 'Förnamn',
  lastName: 'Efternamn',
  address: 'Storgatan 1',
  zipCode: '85230',
  careOf: '',
};
