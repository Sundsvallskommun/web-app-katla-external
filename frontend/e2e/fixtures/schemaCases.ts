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
  { radio: 'arDuFirmatecknare', value: 'JA' },
  { radio: 'fakturaadressSammaSomForetaget', value: 'JA' },
  { radio: 'verksamhetsbeskrivningsval', value: 'JAG_VILL_SKRIVA_VERKSAMHETSBESKRIVNINGEN_I' },
  { rich: 'verksamhetsbeskrivning', value: description },
];

/** Filed by a representative, invoiced elsewhere, with the business description as a file. */
const companyByRepresentative: Step[] = [
  { radio: 'arDuFirmatecknare', value: 'NEJ' },
  { radio: 'fakturaadressSammaSomForetaget', value: 'NEJ' },
  { text: 'fakturamottagare.utdelningsadress', value: 'Fakturavägen 2' },
  { text: 'fakturamottagare.postnummer', value: '852 30' },
  { text: 'fakturamottagare.postort', value: 'Sundsvall' },
  { radio: 'verksamhetsbeskrivningsval', value: 'JAG_VILL_BIFOGA_VERKSAMHETSBESKRIVNINGEN_SOM' },
];

const premisesAtOwnerAddress: Step[] = [
  { text: 'serveringsstalletsNamn', value: 'Teststället' },
  { radio: 'besoksadressSammaSomArendeagare', value: 'JA' },
  { text: 'kontaktuppgifterTillServeringsstallet.telefonnummer', value: MOCK_PHONE_NUMBER },
];

const visitingAddress: Step[] = [
  { text: 'besoksadress.gatuadress', value: 'Storgatan 10' },
  { text: 'besoksadress.postnummer', value: '852 30' },
  { text: 'besoksadress.postort', value: 'Sundsvall' },
];

const passedKnowledgeTest: Step[] = [
  { radio: 'kunskapOmAlkohollagen', value: 'HAR_GODKANT_KUNSKAPSPROV' },
  { text: 'personnummer.personnummer', value: MOCK_HYPHEN_PERSON_NUMBER },
];

const ownFunds: Step[] = [
  { check: 'finansiering', values: ['EGNA_MEDEL'] },
  { row: 'egnaMedel', values: { bank: 'Testbanken', kontonummer: '1234-5678901', beloppKronor: '250000' } },
];

const servingManager: Step = {
  row: 'serveringsansvarigPersonal',
  values: { fornamn: 'Anna', efternamn: 'Testsson', fodelsedatum: '1985-04-12', fromDate: '2026-11-01' },
};

const orderAndSobriety: Step = {
  rich: 'ordningOchNykterhet',
  value: 'Utbildad personal och legitimationskontroll.',
};

const folkolServing: Step[] = [
  { radio: 'livsmedelsregistrerad', value: 'JA' },
  { check: 'livsmedelsregistreringKanVisasVidTillsyn', values: ['JAG_KAN_VISA_LIVSMEDELSREGISTRERINGEN'] },
  { radio: 'egenkontrollprogramFolkol', value: 'NEJ_JAG_FYLLER_I_DOKUMENTET' },
  ...premisesAtOwnerAddress,
];

const temporaryServing: Step[] = [
  ...passedKnowledgeTest,
  { text: 'angeMellanVilkaDatumDetTillfalliga.startDate', value: '2026-11-20' },
  { text: 'angeMellanVilkaDatumDetTillfalliga.endDate', value: '2026-11-22' },
  { time: 'klockslagForServeringen.startTime', value: '18:00' },
  { time: 'klockslagForServeringen.endTime', value: '01:00' },
  { check: 'alkoholdrycker', values: ['VIN'] },
  { radio: 'dryckesmenyval', value: 'JAG_VILL_BESKRIVA' },
  { rich: 'dryckesmeny', value: 'Vin och alkoholfritt.' },
  { radio: 'serverasMat', value: 'NEJ' },
  ...ownFunds,
  { text: 'beraknatAntalGaster.antal', value: '300' },
  { rich: 'vadArDetForTypAvTillstallning', value: 'Julmarknad med musikscen.' },
  { text: 'serveringsstalletsNamn', value: 'Stora torget' },
  { text: 'kontaktuppgifterTillServeringsstallet.telefonnummer', value: MOCK_PHONE_NUMBER },
  ...visitingAddress,
  servingManager,
  orderAndSobriety,
  { text: 'sittplatserILokalen.antalSittplatserInomhus', value: '120' },
  { text: 'maximaltAntalPersonerILokalen.antalPersoner', value: '400' },
  { radio: 'finnsPolistillstand', value: 'EJ_AKTUELLT' },
];

const permanentTobaccoSales: Step[] = [
  { radio: 'tidsperiodForForsaljningen', value: 'TILLSVIDARE' },
  { text: 'startdatumForsaljning', value: '2027-01-01' },
  ...premisesAtOwnerAddress,
  { radio: 'bedriverAvenDistansforsaljning', value: 'NEJ' },
];

export const happyPaths: SchemaCase[] = [
  {
    title: 'Anmälan om försäljning av folköl',
    schema: 'aot-alcohol-folkol-folkol-sales-notification',
    steps: [
      ...company('Kiosk som säljer folköl.'),
      { radio: 'stadigvarandeForsaljningAvLivsmedel', value: 'JA' },
      { check: 'dokumentationKanVisasVidTillsyn', values: ['JAG_KAN_VISA_DOKUMENTATION'] },
      { radio: 'tillverkarFolkolPaForsaljningsstallet', value: 'NEJ' },
      { radio: 'egenkontrollprogramFolkol', value: 'NEJ_JAG_FYLLER_I_DOKUMENTET' },
      ...premisesAtOwnerAddress,
    ],
    attachments: [],
    absent: ['fakturamottagare', 'besoksadress'],
  },
  {
    title: 'Anmälan om servering av endast folköl',
    schema: 'aot-alcohol-folkol-folkol-serving-notification',
    steps: [...company('Café som serverar folköl.'), ...folkolServing],
    attachments: [],
    absent: ['fakturamottagare', 'besoksadress'],
  },
  {
    title: 'Anmälan om försäljning och servering av folköl',
    schema: 'aot-alcohol-folkol-folkol-sales-serving-notification',
    steps: [...company('Restaurang som både säljer och serverar folköl.'), ...folkolServing],
    attachments: [],
    absent: ['fakturamottagare', 'besoksadress'],
  },
  {
    title: 'Gårdsförsäljning',
    schema: 'aot-alcohol-serving-permit-application-farm-sales',
    steps: [
      ...company('Bryggeri som vill sälja till besökare.'),
      { text: 'serveringsstalletsNamn', value: 'Testgården' },
      { text: 'kontaktuppgifterTillServeringsstallet.telefonnummer', value: MOCK_PHONE_NUMBER },
      ...visitingAddress,
      { check: 'alkoholdrycker', values: ['STARKOL'] },
      { text: 'literStarkol', value: '12000' },
      { text: 'produktionenStartade', value: '2020-05-01' },
      { radio: 'beroendeTillAnnanTillverkare', value: 'NEJ' },
      { radio: 'produktionsbeskrivningsval', value: 'JAG_VILL_BESKRIVA' },
      { rich: 'produktionsbeskrivning', value: 'Egen bryggning i gårdens lokaler.' },
      { radio: 'forsaljningsperiod', value: 'ARET_RUNT' },
      { time: 'forsaljningstider.startTime', value: '11:00' },
      { time: 'forsaljningstider.endTime', value: '18:00' },
      { radio: 'besoksarrangemang', value: 'JAG_VILL_BESKRIVA_BESOKSARRANGEMANGET' },
      { rich: 'beskrivBesoksarrangemanget', value: 'Guidad visning med provsmakning.' },
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
    absent: ['literVin', 'beskrivBeroende', 'angePeriodForForsaljning', 'organisationsnummer', 'banklan'],
  },
  {
    title: 'Provsmakning',
    schema: 'aot-alcohol-serving-permit-application-tasting',
    steps: [
      ...company('Destilleri som vill erbjuda provsmakning.'),
      ...passedKnowledgeTest,
      { check: 'verksamhetensInriktning', values: ['TILLVERKARE'] },
      { radio: 'arrangeraMassa', value: 'NEJ' },
      { check: 'alkoholdrycker', values: ['SPRITDRYCKER'] },
      ...ownFunds,
      { radio: 'besoksadressSammaSomArendeagare', value: 'JA' },
      orderAndSobriety,
    ],
    attachments: ['BANK_STATEMENT', 'FLOOR_PLAN', 'PREMISES_AGREEMENT'],
    absent: ['anmalPersonerTillKunskapsprovet', 'besoksadress', 'banklan'],
  },
  {
    title: 'Stadigvarande catering – slutna sällskap',
    schema: 'aot-alcohol-serving-permit-application-permanent-catering',
    steps: [
      ...company('Cateringföretag för slutna sällskap.'),
      ...passedKnowledgeTest,
      { check: 'alkoholdrycker', values: ['VIN'] },
      { radio: 'serverasMat', value: 'JA' },
      ...ownFunds,
      orderAndSobriety,
      { check: 'godkannaCateringtillfalle', values: ['JAG_AR_MEDVETEN_OM_ATT'] },
    ],
    attachments: ['BANK_STATEMENT', 'BUDGET'],
    absent: ['organisationsnummer', 'banklan'],
  },
  {
    title: 'Stadigvarande servering',
    schema: 'aot-alcohol-serving-permit-application-permanent-serving',
    steps: [
      ...company('Restaurang i centrala Sundsvall.'),
      ...passedKnowledgeTest,
      { check: 'verksamhetensInriktning', values: ['RESTAURANG'] },
      { radio: 'serveringTillAllmanhetenEllerSlutetSallskap', value: 'ENBART_TILL_ALLMANHETEN' },
      { radio: 'serveringsperiodForAllmanheten', value: 'ARET_RUNT' },
      { time: 'serveringstiderInomhusAllmanheten.startTime', value: '11:00' },
      { time: 'serveringstiderInomhusAllmanheten.endTime', value: '23:00' },
      { time: 'serveringstiderUtomhusAllmanheten.startTime', value: '11:00' },
      { time: 'serveringstiderUtomhusAllmanheten.endTime', value: '22:00' },
      { check: 'alkoholdrycker', values: ['STARKOL'] },
      ...ownFunds,
      ...premisesAtOwnerAddress,
      { check: 'forfoganderattLokal', values: ['HYRESAVTAL'] },
      { radio: 'harSamarbetsavtal', value: 'NEJ' },
      orderAndSobriety,
      { text: 'sittplatserILokalen.antalSittplatserInomhus', value: '80' },
      { text: 'maximaltAntalPersonerILokalen.antalPersoner', value: '150' },
    ],
    attachments: ['BUDGET', 'BANK_STATEMENT', 'FLOOR_PLAN', 'LEASE_AGREEMENT'],
    absent: ['harNi', 'serveringsperiodForSlutetSallskap', 'serveringstiderInomhusSlutetSallskap', 'besoksadress'],
  },
  {
    title: 'Tillfälligt tillstånd – allmänheten',
    schema: 'aot-alcohol-serving-permit-application-temporary-serving-public',
    steps: [...company('Eventbolag som arrangerar en julmarknad.'), ...temporaryServing],
    attachments: ['SERVING_AREA_DRAWING', 'PREMISES_AGREEMENT', 'BUDGET', 'BANK_STATEMENT'],
    absent: ['menyval', 'menyBeskrivning', 'organisationsnummer'],
  },
  {
    title: 'Tillfälligt tillstånd – slutet sällskap',
    schema: 'aot-alcohol-serving-permit-application-temporary-serving-private',
    steps: [
      ...company('Förening som ordnar en medlemsfest.'),
      ...temporaryServing,
      { check: 'gaster', values: ['MEDLEMMAR'] },
      { rich: 'hurHarGasternaBjuditsIn', value: 'Personlig inbjudan via e-post.' },
    ],
    attachments: ['SERVING_AREA_DRAWING', 'PREMISES_AGREEMENT', 'BUDGET', 'GUEST_LIST', 'BANK_STATEMENT'],
    absent: ['menyval', 'menyBeskrivning'],
  },
  {
    title: 'Anmälan om försäljning av elektroniska cigaretter',
    schema: 'aot-tobacco-ecigarette-sales-notification',
    steps: [
      ...company('Kiosk som säljer e-cigaretter.'),
      ...permanentTobaccoSales,
      { radio: 'omfattarSarskiltFarligaProdukter', value: 'NEJ' },
      { radio: 'avtalMedTillverkareEllerPartihandlare', value: 'NEJ' },
    ],
    attachments: ['PRODUCT_LIST', 'SELF_MONITORING_PROGRAM'],
    absent: ['periodTidsbegransadForsaljning', 'besoksadress', 'hemsida'],
  },
  {
    title: 'Ansökan om försäljning av tobaksvaror',
    schema: 'aot-tobacco-sales-permit-application',
    steps: [
      ...company('Tobaksbutik i centrum.'),
      ...permanentTobaccoSales,
      { radio: 'omfattarSarskiltFarligaProdukter', value: 'NEJ' },
      ...ownFunds,
      { radio: 'avtalMedTillverkareEllerPartihandlare', value: 'NEJ' },
    ],
    attachments: ['BANK_STATEMENT', 'PRODUCT_LIST', 'RIGHT_OF_DISPOSAL', 'SELF_MONITORING_PROGRAM'],
    absent: ['periodTidsbegransadForsaljning', 'besoksadress', 'hemsida', 'banklan'],
  },
  {
    title: 'Anmälan om försäljning av tobaksfria nikotinprodukter',
    schema: 'aot-tobacco-tobacco-free-nicotine-sales-notification',
    steps: [
      ...company('Butik som säljer nikotinpåsar.'),
      ...permanentTobaccoSales,
      { radio: 'avtalMedTillverkareEllerPartihandlare', value: 'NEJ' },
    ],
    attachments: ['PRODUCT_LIST', 'SELF_MONITORING_PROGRAM'],
    absent: ['periodTidsbegransadForsaljning', 'besoksadress', 'hemsida'],
  },
];

/** Branches the happy paths cannot reach: the other answer of a condition, and the bilagor it demands. */
export const branches: SchemaCase[] = [
  {
    title: 'folköl via ombud med beskrivningen som fil',
    schema: 'aot-alcohol-folkol-folkol-sales-serving-notification',
    steps: [...companyByRepresentative, ...folkolServing],
    attachments: ['POWER_OF_ATTORNEY', 'BUSINESS_DESCRIPTION'],
    absent: ['verksamhetsbeskrivning'],
  },
  {
    title: 'provsmakning på mässa med kunskapsprov att skriva och banklån',
    schema: 'aot-alcohol-serving-permit-application-tasting',
    steps: [
      ...company('Destilleri som ställer ut på mässa.'),
      { radio: 'kunskapOmAlkohollagen', value: 'BEHOVER_SKRIVA_KUNSKAPSPROV' },
      { radio: 'anmalPersonerTillKunskapsprovet', value: 'VILL_ANMALA_NU' },
      {
        row: 'personerTillKunskapsprovet',
        values: { fornamn: 'Erik', efternamn: 'Provsson', personnummer: MOCK_HYPHEN_PERSON_NUMBER },
      },
      { check: 'verksamhetensInriktning', values: ['PARTIHANDLARE'] },
      { radio: 'arrangeraMassa', value: 'JA' },
      { check: 'alkoholdrycker', values: ['VIN'] },
      { check: 'finansiering', values: ['BANKLAN'] },
      { row: 'banklan', values: { langivare: 'Testbanken', beloppKronor: '400000' } },
      { radio: 'besoksadressSammaSomArendeagare', value: 'NEJ' },
      ...visitingAddress,
      orderAndSobriety,
    ],
    attachments: ['BANK_LOAN_CERTIFICATE', 'FLOOR_PLAN', 'PREMISES_AGREEMENT', 'EXHIBITORS_LIST'],
    absent: ['personnummer', 'egnaMedel'],
  },
  {
    title: 'hotell med servering till både allmänheten och slutet sällskap under viss period',
    schema: 'aot-alcohol-serving-permit-application-permanent-serving',
    steps: [
      ...company('Hotell med restaurang.'),
      ...passedKnowledgeTest,
      { check: 'verksamhetensInriktning', values: ['RESTAURANG', 'HOTELL'] },
      { check: 'harNi', values: ['RUMSSERVERING'] },
      { radio: 'serveringTillAllmanhetenEllerSlutetSallskap', value: 'BADE_TILL_ALLMANHETEN_OCH_TILL' },
      { radio: 'serveringsperiodForAllmanheten', value: 'ARET_RUNT' },
      { time: 'serveringstiderInomhusAllmanheten.startTime', value: '11:00' },
      { time: 'serveringstiderInomhusAllmanheten.endTime', value: '01:00' },
      { time: 'serveringstiderUtomhusAllmanheten.startTime', value: '11:00' },
      { time: 'serveringstiderUtomhusAllmanheten.endTime', value: '22:00' },
      { radio: 'serveringsperiodForSlutetSallskap', value: 'ARLIGEN_UNDER_VISS_PERIOD' },
      { text: 'periodServeringSlutetSallskap.startDate', value: '2026-05-01' },
      { text: 'periodServeringSlutetSallskap.endDate', value: '2026-09-30' },
      { time: 'serveringstiderInomhusSlutetSallskap.startTime', value: '17:00' },
      { time: 'serveringstiderInomhusSlutetSallskap.endTime', value: '02:00' },
      { time: 'serveringstiderUtomhusSlutetSallskap.startTime', value: '17:00' },
      { time: 'serveringstiderUtomhusSlutetSallskap.endTime', value: '23:00' },
      { check: 'alkoholdrycker', values: ['STARKOL'] },
      { check: 'finansiering', values: ['ANNAN_FINANSIERING_EXEMPELVIS_ALMILAN_BRYGGERILAN'] },
      { row: 'annanFinansiering', values: { lanetyp: 'Almilån', langivare: 'Almi', beloppKronor: '500000' } },
      ...premisesAtOwnerAddress,
      { check: 'forfoganderattLokal', values: ['HYRESAVTAL'] },
      { radio: 'harSamarbetsavtal', value: 'JA' },
      orderAndSobriety,
      { text: 'sittplatserILokalen.antalSittplatserInomhus', value: '80' },
      { text: 'maximaltAntalPersonerILokalen.antalPersoner', value: '150' },
    ],
    attachments: ['BUDGET', 'OTHER_FINANCING_CERTIFICATE', 'FLOOR_PLAN', 'LEASE_AGREEMENT', 'BUSINESS_AGREEMENT'],
    absent: ['egnaMedel'],
  },
  {
    title: 'tidsbegränsad e-cigarettförsäljning med distansförsäljning och farliga produkter',
    schema: 'aot-tobacco-ecigarette-sales-notification',
    steps: [
      ...company('Säsongskiosk med webbshop.'),
      { radio: 'tidsperiodForForsaljningen', value: 'TIDSBEGRANSAD_FORSALJNING' },
      { text: 'periodTidsbegransadForsaljning.startDate', value: '2027-06-01' },
      { text: 'periodTidsbegransadForsaljning.endDate', value: '2027-08-31' },
      { text: 'serveringsstalletsNamn', value: 'Vape-kiosken' },
      { radio: 'besoksadressSammaSomArendeagare', value: 'NEJ' },
      ...visitingAddress,
      { text: 'kontaktuppgifterTillServeringsstallet.telefonnummer', value: MOCK_PHONE_NUMBER },
      { radio: 'bedriverAvenDistansforsaljning', value: 'JA' },
      { text: 'hemsida', value: 'https://example.com' },
      { radio: 'omfattarSarskiltFarligaProdukter', value: 'JA' },
      { radio: 'avtalMedTillverkareEllerPartihandlare', value: 'JA' },
    ],
    attachments: [
      'COUNTY_BOARD_REGISTRATION',
      'SUPPLIER_AGREEMENT',
      'PRODUCT_LIST',
      'RIGHT_OF_DISPOSAL',
      'SALES_SITE_PHOTO',
      'SELF_MONITORING_PROGRAM',
    ],
    absent: ['startdatumForsaljning'],
  },
];
