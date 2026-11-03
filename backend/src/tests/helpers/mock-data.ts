// Shared test values for the backend unit tests. Tests must not hardcode person numbers,
// organization numbers, phone numbers or party ids - import them from here instead, so there is a
// single place to check that no production-like identifier ever enters the repo.

// IMPORTANT
// The value below is a test person number from Skatteverket, it is not a real person number
export const mockPersonNumber = '199001012385';
// The same test person number with the separator the citizen responses carry
export const mockPersonNumberHyphenated = '19900101-2385';
// The same test person number in the ten-digit form an IDP may send it in
export const mockPersonNumberShort = '900101-2385';
// The same birth date as a coordination number: the day carries the +60 offset
export const mockCoordinationNumber = '199001612382';
// Birth dates that cannot be. The check digits are valid, so only the date makes these rejectable
export const mockFutureDatePersonNumber = '209001012385';
export const mockImpossibleDatePersonNumber = '199002312388';
// A mock birth date whose Luhn check digit is one off
export const mockPersonNumberBadCheckDigit = '199001012386';

// The value below is an organization number for testing, it is not a real organization number
export const mockOrganizationNumber = '5560269986';
// A second test organization number, so two organizations in one list do not share a number
export const mockSecondaryOrganizationNumber = '5567037485';
// A third, used where a lookup has to fail for one organization while the others succeed
export const mockUnresolvableOrganizationNumber = '5590000000';

// Party ids are opaque UUIDs assigned by the citizen/legal entity services. These are
// syntactically valid but arbitrary, they do not identify anyone.
export const mockCitizenPartyId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
// A second citizen, for the tests that check one citizen may not touch another citizen's errand
export const mockOtherCitizenPartyId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
export const mockOrganizationPartyId = '11111111-2222-4333-8444-555555555555';
// A second organization party id, for the citizen who may act for more than one organization
export const mockSecondaryOrganizationPartyId = '22222222-3333-4444-8555-666666666666';
// The party id of an organization the session may NOT act for, used by the scoping tests
export const mockForeignOrganizationPartyId = '99999999-8888-4777-8666-555555555555';
// The party id a mandate names as its grantor, before it is resolved to an organization
export const mockGrantorPartyId = '33333333-4444-4555-8666-777777777777';

// Test names, they do not identify anyone
export const mockFirstName = 'Anna';
export const mockLastName = 'Andersson';
export const mockOrganizationName = 'Testbolaget AB';
export const mockSecondaryOrganizationName = 'Andra Testbolaget AB';

// The value below is a test email, it is not a real email
export const mockEmail = 'anna@example.com';
// The value below is a test phone number from Post- och telestyrelsen, it is not a real number
export const mockCountryCodePhoneNumber = '+46701740635';
export const mockPhoneNumber = '0701740635';

// Errand identifiers
export const mockErrandId = '3f1b0c9e-0000-4000-8000-000000000001';
export const mockErrandNumber = 'AIA-25120019';
// An errand number that matches nothing, for the not-found paths
export const mockMissingErrandNumber = 'AIA-25999999';

// The values below are seeded as env vars by src/tests/setup.ts before any module loads
// (@/config snapshots process.env at import time), and are imported by the tests that assert
// against them, so the two cannot drift.
export const mockMunicipalityId = '2281';
export const mockNamespace = 'test';
// The service key SERVICE_NAMESPACES maps to mockNamespace; sent as the x-service-key header
export const mockServiceKey = 'alkoholtillstand';
