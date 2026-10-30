import { MOCK_HYPHEN_PERSON_NUMBER, MOCK_PHONE_NUMBER } from '../utils/constants';
import type { Step } from '../utils/schema-form';

/**
 * One registration per published schema: the answers to give, in the order the conditional fields
 * appear, and the attachment types those answers make mandatory. Mirrors the manual flow test in
 * TESTLOGG.md.
 */
export interface SchemaCase {
  title: string;
  /** Mock file name without the .schema.json suffix. */
  schema: string;
  steps: Step[];
  attachments: string[];
  /** Properties whose branch was not taken and therefore must not reach the errand. */
  absent?: string[];
}

const company = (description: string): Step[] => [
  { radio: 'isAuthorizedSignatory', value: 'YES' },
  { radio: 'invoiceAddressSameAsCompany', value: 'YES' },
  { radio: 'businessDescriptionChoice', value: 'DESCRIBE' },
  { rich: 'businessDescription', value: description },
];

/** Filed by a representative, invoiced elsewhere, with the business description as a file. */
const companyByRepresentative: Step[] = [
  { radio: 'isAuthorizedSignatory', value: 'NO' },
  { radio: 'invoiceAddressSameAsCompany', value: 'NO' },
  { text: 'invoiceRecipient.street', value: 'Fakturavägen 2' },
  { text: 'invoiceRecipient.postalCode', value: '852 30' },
  { text: 'invoiceRecipient.city', value: 'Sundsvall' },
  { radio: 'businessDescriptionChoice', value: 'UPLOAD' },
];

/** Alcohol schemas say premises, tobacco schemas point of sale, as the PartyAsset schemas do. */
type Site = 'premises' | 'pointOfSale';

const atOwnerAddress = (site: Site): Step[] => [
  { text: `${site}Name`, value: 'Teststället' },
  { radio: `${site}AddressSameAsCompany`, value: 'YES' },
  { text: `${site}Contact.phoneNumber`, value: MOCK_PHONE_NUMBER },
];

const visitingAddress = (site: Site): Step[] => [
  { text: `${site}Address.street`, value: 'Storgatan 10' },
  { text: `${site}Address.postalCode`, value: '852 30' },
  { text: `${site}Address.city`, value: 'Sundsvall' },
];

const passedKnowledgeTest: Step[] = [
  { radio: 'knowledgeOfAlcoholAct', value: 'PASSED_KNOWLEDGE_TEST' },
  { text: 'knowledgeTestPassedBy.personalIdentityNumber', value: MOCK_HYPHEN_PERSON_NUMBER },
];

const ownFunds: Step[] = [
  { check: 'financing', values: ['OWN_FUNDS'] },
  { row: 'ownFunds', values: { bank: 'Testbanken', accountNumber: '1234-5678901', amountSek: '250000' } },
];

const servingManager: Step = {
  row: 'responsibleServingStaff',
  values: { firstName: 'Anna', lastName: 'Testsson', dateOfBirth: '1985-04-12', fromDate: '2026-11-01' },
};

const orderAndSobriety: Step = {
  rich: 'orderAndSobriety',
  value: 'Utbildad personal och legitimationskontroll.',
};

const folkolServing: Step[] = [
  { radio: 'isFoodRegistered', value: 'YES' },
  { check: 'canShowFoodRegistrationAtInspection', values: ['CAN_SHOW_FOOD_REGISTRATION'] },
  { radio: 'selfMonitoringProgram', value: 'NO_CAN_SHOW_AT_INSPECTION' },
  ...atOwnerAddress('premises'),
];

const temporaryServing: Step[] = [
  ...passedKnowledgeTest,
  { text: 'permitPeriodDates.fromDate', value: '2026-11-20' },
  { text: 'permitPeriodDates.toDate', value: '2026-11-22' },
  { time: 'dailyServingHours.from', value: '18:00' },
  { time: 'dailyServingHours.to', value: '01:00' },
  { check: 'beverages', values: ['WINE'] },
  { radio: 'drinksMenuChoice', value: 'DESCRIBE' },
  { rich: 'drinksMenuDescription', value: 'Vin och alkoholfritt.' },
  { radio: 'servesFood', value: 'NO' },
  ...ownFunds,
  { text: 'expectedGuests.count', value: '300' },
  { rich: 'eventType', value: 'Julmarknad med musikscen.' },
  { text: 'premisesName', value: 'Stora torget' },
  { text: 'premisesContact.phoneNumber', value: MOCK_PHONE_NUMBER },
  ...visitingAddress('premises'),
  servingManager,
  orderAndSobriety,
  { text: 'seating.seatsIndoor', value: '120' },
  { text: 'maxPersonsInPremises.maxPersons', value: '400' },
  { radio: 'hasAppliedForPolicePermit', value: 'NOT_APPLICABLE' },
];

const permanentTobaccoSales: Step[] = [
  { radio: 'salesPeriod', value: 'INDEFINITE' },
  { text: 'salesStartDate', value: '2027-01-01' },
  ...atOwnerAddress('pointOfSale'),
  { radio: 'includesDistanceSelling', value: 'NO' },
];

export const happyPaths: SchemaCase[] = [
  {
    title: 'Anmälan om försäljning av folköl',
    schema: 'aot-alcohol-folkol-folkol-sales-notification',
    steps: [
      ...company('Kiosk som säljer folköl.'),
      { radio: 'hasPermanentFoodSales', value: 'YES' },
      { check: 'canShowDocumentationAtInspection', values: ['CAN_SHOW_DOCUMENTATION'] },
      { radio: 'producesLowAlcoholBeerOnPremises', value: 'NO' },
      { radio: 'selfMonitoringProgram', value: 'NO_CAN_SHOW_AT_INSPECTION' },
      ...atOwnerAddress('premises'),
    ],
    attachments: [],
    absent: ['invoiceRecipient', 'premisesAddress'],
  },
  {
    title: 'Anmälan om servering av endast folköl',
    schema: 'aot-alcohol-folkol-folkol-serving-notification',
    steps: [...company('Café som serverar folköl.'), ...folkolServing],
    attachments: [],
    absent: ['invoiceRecipient', 'premisesAddress'],
  },
  {
    title: 'Anmälan om försäljning och servering av folköl',
    schema: 'aot-alcohol-folkol-folkol-sales-serving-notification',
    steps: [...company('Restaurang som både säljer och serverar folköl.'), ...folkolServing],
    attachments: [],
    absent: ['invoiceRecipient', 'premisesAddress'],
  },
  {
    title: 'Gårdsförsäljning',
    schema: 'aot-alcohol-serving-permit-application-farm-sales',
    steps: [
      ...company('Bryggeri som vill sälja till besökare.'),
      { text: 'premisesName', value: 'Testgården' },
      { text: 'premisesContact.phoneNumber', value: MOCK_PHONE_NUMBER },
      ...visitingAddress('premises'),
      { check: 'beverages', values: ['STRONG_BEER'] },
      { text: 'strongBeerLiters', value: '12000' },
      { text: 'productionStartDate', value: '2020-05-01' },
      { radio: 'dependsOnOtherProducer', value: 'NO' },
      { radio: 'productionDescriptionChoice', value: 'DESCRIBE' },
      { rich: 'productionDescription', value: 'Egen bryggning i gårdens lokaler.' },
      { radio: 'salesPeriod', value: 'ALL_YEAR' },
      { time: 'salesHours.from', value: '11:00' },
      { time: 'salesHours.to', value: '18:00' },
      { radio: 'visitorArrangementsChoice', value: 'DESCRIBE' },
      { rich: 'visitorArrangementsDescription', value: 'Guidad visning med provsmakning.' },
      ...passedKnowledgeTest,
      servingManager,
      ...ownFunds,
    ],
    attachments: [
      'INDEPENDENCE_CERTIFICATE',
      'BONDED_WAREHOUSE_REGISTRATION',
      'PRODUCTION_VOLUME_EVIDENCE',
      'BANK_STATEMENT',
      'SELF_MONITORING_PROGRAM',
      'SALES_PREMISES_DRAWING',
      'LEASE_OR_OWNERSHIP_PROOF',
    ],
    absent: ['wineLiters', 'dependencyDescription', 'salesPeriodDates', 'otherLicensedBusiness', 'bankLoans'],
  },
  {
    title: 'Provsmakning',
    schema: 'aot-alcohol-serving-permit-application-tasting',
    steps: [
      ...company('Destilleri som vill erbjuda provsmakning.'),
      ...passedKnowledgeTest,
      { check: 'businessOrientationTypes', values: ['PRODUCER'] },
      { radio: 'arrangesTradeFair', value: 'NO' },
      { check: 'beverages', values: ['SPIRITS'] },
      ...ownFunds,
      { radio: 'premisesAddressSameAsCompany', value: 'YES' },
      orderAndSobriety,
    ],
    attachments: ['BANK_STATEMENT', 'FLOOR_PLAN', 'PREMISES_AGREEMENT'],
    absent: ['knowledgeTestRegistration', 'premisesAddress', 'bankLoans'],
  },
  {
    title: 'Stadigvarande catering – slutna sällskap',
    schema: 'aot-alcohol-serving-permit-application-permanent-catering',
    steps: [
      ...company('Cateringföretag för slutna sällskap.'),
      ...passedKnowledgeTest,
      { check: 'beverages', values: ['WINE'] },
      { radio: 'servesFood', value: 'YES' },
      ...ownFunds,
      orderAndSobriety,
      { check: 'cateringOccasionAcknowledgement', values: ['ACKNOWLEDGED'] },
    ],
    attachments: ['BANK_STATEMENT', 'BUDGET'],
    absent: ['otherLicensedBusiness', 'bankLoans'],
  },
  {
    title: 'Stadigvarande servering',
    schema: 'aot-alcohol-serving-permit-application-permanent-serving',
    steps: [
      ...company('Restaurang i centrala Sundsvall.'),
      ...passedKnowledgeTest,
      { check: 'businessOrientationTypes', values: ['RESTAURANT'] },
      { radio: 'servingAudience', value: 'PUBLIC' },
      { radio: 'publicServingPeriod', value: 'ALL_YEAR' },
      { time: 'publicServingHoursIndoor.from', value: '11:00' },
      { time: 'publicServingHoursIndoor.to', value: '23:00' },
      { time: 'publicServingHoursOutdoor.from', value: '11:00' },
      { time: 'publicServingHoursOutdoor.to', value: '22:00' },
      { check: 'beverages', values: ['STRONG_BEER'] },
      ...ownFunds,
      ...atOwnerAddress('premises'),
      { check: 'premisesRightOfUseDocuments', values: ['LEASE_AGREEMENT'] },
      { radio: 'hasCooperationAgreement', value: 'NO' },
      orderAndSobriety,
      { text: 'seating.seatsIndoor', value: '80' },
      { text: 'maxPersonsInPremises.maxPersons', value: '150' },
    ],
    attachments: ['BUDGET', 'BANK_STATEMENT', 'FLOOR_PLAN', 'LEASE_AGREEMENT'],
    absent: ['additionalScopes', 'closedCompanyServingPeriod', 'closedCompanyServingHoursIndoor', 'premisesAddress'],
  },
  {
    title: 'Tillfälligt tillstånd – allmänheten',
    schema: 'aot-alcohol-serving-permit-application-temporary-serving-public',
    steps: [...company('Eventbolag som arrangerar en julmarknad.'), ...temporaryServing],
    attachments: ['SERVING_AREA_DRAWING', 'PREMISES_AGREEMENT', 'BUDGET', 'BANK_STATEMENT'],
    absent: ['menuChoice', 'menuDescription', 'otherLicensedBusiness'],
  },
  {
    title: 'Tillfälligt tillstånd – slutet sällskap',
    schema: 'aot-alcohol-serving-permit-application-temporary-serving-private',
    steps: [
      ...company('Förening som ordnar en medlemsfest.'),
      ...temporaryServing,
      { check: 'guestTypes', values: ['MEMBERS'] },
      { rich: 'guestInvitationMethod', value: 'Personlig inbjudan via e-post.' },
    ],
    attachments: ['SERVING_AREA_DRAWING', 'PREMISES_AGREEMENT', 'BUDGET', 'GUEST_LIST', 'BANK_STATEMENT'],
    absent: ['menuChoice', 'menuDescription'],
  },
  {
    title: 'Anmälan om försäljning av elektroniska cigaretter',
    schema: 'aot-tobacco-ecigarette-sales-notification',
    steps: [
      ...company('Kiosk som säljer e-cigaretter.'),
      ...permanentTobaccoSales,
      { radio: 'includesParticularlyDangerousProducts', value: 'NO' },
      { radio: 'hasSupplierAgreement', value: 'NO' },
    ],
    attachments: ['PRODUCT_LIST', 'SELF_MONITORING_PROGRAM'],
    absent: ['salesPeriodDates', 'pointOfSaleAddress', 'distanceSellingWebsite'],
  },
  {
    title: 'Ansökan om försäljning av tobaksvaror',
    schema: 'aot-tobacco-sales-permit-application',
    steps: [
      ...company('Tobaksbutik i centrum.'),
      ...permanentTobaccoSales,
      { radio: 'includesParticularlyDangerousProducts', value: 'NO' },
      ...ownFunds,
      { radio: 'hasSupplierAgreement', value: 'NO' },
    ],
    attachments: ['BANK_STATEMENT', 'PRODUCT_LIST', 'RIGHT_OF_DISPOSAL', 'SELF_MONITORING_PROGRAM'],
    absent: ['salesPeriodDates', 'pointOfSaleAddress', 'distanceSellingWebsite', 'bankLoans'],
  },
  {
    title: 'Anmälan om försäljning av tobaksfria nikotinprodukter',
    schema: 'aot-tobacco-tobacco-free-nicotine-sales-notification',
    steps: [
      ...company('Butik som säljer nikotinpåsar.'),
      ...permanentTobaccoSales,
      { radio: 'hasSupplierAgreement', value: 'NO' },
    ],
    attachments: ['PRODUCT_LIST', 'SELF_MONITORING_PROGRAM'],
    absent: ['salesPeriodDates', 'pointOfSaleAddress', 'distanceSellingWebsite'],
  },
];

/** Branches the happy paths cannot reach: the other answer of a condition, and the bilagor it demands. */
export const branches: SchemaCase[] = [
  {
    title: 'folköl via ombud med beskrivningen som fil',
    schema: 'aot-alcohol-folkol-folkol-sales-serving-notification',
    steps: [...companyByRepresentative, ...folkolServing],
    attachments: ['POWER_OF_ATTORNEY', 'BUSINESS_DESCRIPTION'],
    absent: ['businessDescription'],
  },
  {
    title: 'provsmakning på mässa med kunskapsprov att skriva och banklån',
    schema: 'aot-alcohol-serving-permit-application-tasting',
    steps: [
      ...company('Destilleri som ställer ut på mässa.'),
      { radio: 'knowledgeOfAlcoholAct', value: 'KNOWLEDGE_TEST_REQUIRED' },
      { radio: 'knowledgeTestRegistration', value: 'NOW' },
      {
        row: 'knowledgeTestParticipants',
        values: { firstName: 'Erik', lastName: 'Provsson', personalIdentityNumber: MOCK_HYPHEN_PERSON_NUMBER },
      },
      { check: 'businessOrientationTypes', values: ['WHOLESALER'] },
      { radio: 'arrangesTradeFair', value: 'YES' },
      { check: 'beverages', values: ['WINE'] },
      { check: 'financing', values: ['BANK_LOAN'] },
      { row: 'bankLoans', values: { lender: 'Testbanken', amountSek: '400000' } },
      { radio: 'premisesAddressSameAsCompany', value: 'NO' },
      ...visitingAddress('premises'),
      orderAndSobriety,
    ],
    attachments: ['BANK_LOAN_CERTIFICATE', 'FLOOR_PLAN', 'PREMISES_AGREEMENT', 'EXHIBITORS_LIST'],
    absent: ['knowledgeTestPassedBy', 'ownFunds'],
  },
  {
    title: 'hotell med servering till både allmänheten och slutet sällskap under viss period',
    schema: 'aot-alcohol-serving-permit-application-permanent-serving',
    steps: [
      ...company('Hotell med restaurang.'),
      ...passedKnowledgeTest,
      { check: 'businessOrientationTypes', values: ['RESTAURANT', 'HOTEL'] },
      { check: 'additionalScopes', values: ['ROOM_SERVICE'] },
      { radio: 'servingAudience', value: 'PUBLIC_AND_CLOSED_COMPANY' },
      { radio: 'publicServingPeriod', value: 'ALL_YEAR' },
      { time: 'publicServingHoursIndoor.from', value: '11:00' },
      { time: 'publicServingHoursIndoor.to', value: '01:00' },
      { time: 'publicServingHoursOutdoor.from', value: '11:00' },
      { time: 'publicServingHoursOutdoor.to', value: '22:00' },
      { radio: 'closedCompanyServingPeriod', value: 'ANNUAL_PERIOD' },
      { text: 'closedCompanyServingPeriodDates.fromDate', value: '2026-05-01' },
      { text: 'closedCompanyServingPeriodDates.toDate', value: '2026-09-30' },
      { time: 'closedCompanyServingHoursIndoor.from', value: '17:00' },
      { time: 'closedCompanyServingHoursIndoor.to', value: '02:00' },
      { time: 'closedCompanyServingHoursOutdoor.from', value: '17:00' },
      { time: 'closedCompanyServingHoursOutdoor.to', value: '23:00' },
      { check: 'beverages', values: ['STRONG_BEER'] },
      { check: 'financing', values: ['OTHER_FINANCING'] },
      { row: 'otherFinancing', values: { loanType: 'Almilån', lender: 'Almi', amountSek: '500000' } },
      ...atOwnerAddress('premises'),
      { check: 'premisesRightOfUseDocuments', values: ['LEASE_AGREEMENT'] },
      { radio: 'hasCooperationAgreement', value: 'YES' },
      orderAndSobriety,
      { text: 'seating.seatsIndoor', value: '80' },
      { text: 'maxPersonsInPremises.maxPersons', value: '150' },
    ],
    attachments: ['BUDGET', 'OTHER_FINANCING_CERTIFICATE', 'FLOOR_PLAN', 'LEASE_AGREEMENT', 'BUSINESS_AGREEMENT'],
    absent: ['ownFunds'],
  },
  {
    title: 'tidsbegränsad e-cigarettförsäljning med distansförsäljning och farliga produkter',
    schema: 'aot-tobacco-ecigarette-sales-notification',
    steps: [
      ...company('Säsongskiosk med webbshop.'),
      { radio: 'salesPeriod', value: 'TEMPORARY' },
      { text: 'salesPeriodDates.fromDate', value: '2027-06-01' },
      { text: 'salesPeriodDates.toDate', value: '2027-08-31' },
      { text: 'pointOfSaleName', value: 'Vape-kiosken' },
      { radio: 'pointOfSaleAddressSameAsCompany', value: 'NO' },
      ...visitingAddress('pointOfSale'),
      { text: 'pointOfSaleContact.phoneNumber', value: MOCK_PHONE_NUMBER },
      { radio: 'includesDistanceSelling', value: 'YES' },
      { text: 'distanceSellingWebsite', value: 'https://example.com' },
      { radio: 'includesParticularlyDangerousProducts', value: 'YES' },
      { radio: 'hasSupplierAgreement', value: 'YES' },
    ],
    attachments: [
      'COUNTY_BOARD_REGISTRATION',
      'SUPPLIER_AGREEMENT',
      'PRODUCT_LIST',
      'RIGHT_OF_DISPOSAL',
      'SALES_SITE_PHOTO',
      'SELF_MONITORING_PROGRAM',
    ],
    absent: ['salesStartDate'],
  },
];
