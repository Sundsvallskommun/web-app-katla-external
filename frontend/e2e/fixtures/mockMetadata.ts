import { LabelDTO, MetadataResponseDTO } from '@data-contracts/backend/data-contracts';

// This mocks the backend's own metadata response, which the BFF has already reduced to the subtree
// under the CATEGORY_ROOT node — `labelStructure` is therefore the category list, with no root of
// its own, while every `resourcePath` still carries the upstream `CATEGORYROOT/` prefix.
//
// Three levels, covering the cases the categorization handles: a type with subtypes, a leaf type,
// and a deprecated label that must not be offered.
export const mockSubTypeStadigvarande: LabelDTO = {
  id: '2f0e2b3a-0000-4000-8000-000000000101',
  classification: 'SUBTYPE',
  displayName: 'Stadigvarande servering',
  resourcePath: 'CATEGORYROOT/ALKOHOL/SERVERINGSTILLSTAND/STADIGVARANDE',
  resourceName: 'STADIGVARANDE',
};

export const mockSubTypeTillfalligt: LabelDTO = {
  id: '2f0e2b3a-0000-4000-8000-000000000102',
  classification: 'SUBTYPE',
  displayName: 'Tillfällig servering',
  resourcePath: 'CATEGORYROOT/ALKOHOL/SERVERINGSTILLSTAND/TILLFALLIGT',
  resourceName: 'TILLFALLIGT',
};

export const mockTypeServering: LabelDTO = {
  id: '2f0e2b3a-0000-4000-8000-000000000201',
  classification: 'TYPE',
  displayName: 'Serveringstillstånd',
  resourcePath: 'CATEGORYROOT/ALKOHOL/SERVERINGSTILLSTAND',
  resourceName: 'SERVERINGSTILLSTAND',
  labels: [
    mockSubTypeTillfalligt,
    mockSubTypeStadigvarande,
    {
      id: '2f0e2b3a-0000-4000-8000-000000000103',
      classification: 'SUBTYPE',
      displayName: 'Utgången servering',
      resourcePath: 'CATEGORYROOT/ALKOHOL/SERVERINGSTILLSTAND/UTGANGEN',
      resourceName: 'UTGANGEN',
      deprecated: true,
    },
  ],
};

/** A leaf: choosing it files two labels, not three. */
export const mockTypeFolkol: LabelDTO = {
  id: '2f0e2b3a-0000-4000-8000-000000000202',
  classification: 'TYPE',
  displayName: 'Folköl klass 2',
  resourcePath: 'CATEGORYROOT/ALKOHOL/FOLKOL',
  resourceName: 'FOLKOL',
  labels: [],
};

export const mockCategoryAlkohol: LabelDTO = {
  id: '2f0e2b3a-0000-4000-8000-000000000301',
  classification: 'CATEGORY',
  displayName: 'Alkohol',
  resourcePath: 'CATEGORYROOT/ALKOHOL',
  resourceName: 'ALKOHOL',
  labels: [mockTypeServering, mockTypeFolkol],
};

export const mockCategoryTobak: LabelDTO = {
  id: '2f0e2b3a-0000-4000-8000-000000000302',
  classification: 'CATEGORY',
  displayName: 'Tobak och nikotin',
  resourcePath: 'CATEGORYROOT/TOBAK',
  resourceName: 'TOBAK',
  labels: [
    {
      id: '2f0e2b3a-0000-4000-8000-000000000203',
      classification: 'TYPE',
      displayName: 'Tobaksförsäljning',
      resourcePath: 'CATEGORYROOT/TOBAK/FORSALJNING',
      resourceName: 'FORSALJNING',
      labels: [],
    },
  ],
};

const mockCategoryUtgangen: LabelDTO = {
  id: '2f0e2b3a-0000-4000-8000-000000000303',
  classification: 'CATEGORY',
  displayName: 'Utgången kategori',
  resourcePath: 'CATEGORYROOT/UTGANGEN',
  resourceName: 'UTGANGEN',
  deprecated: true,
  labels: [],
};

export const mockMetadata: MetadataResponseDTO = {
  categories: [
    {
      name: 'KATEGORI',
      displayName: 'test',
      types: [
        {
          name: 'TYPETEST',
          displayName: 'typtest',
          escalationEmail: '',
          created: '2025-12-08T11:49:39.992+01:00',
        },
      ],
      created: '2025-12-08T11:49:20.599+01:00',
    },
  ],
  labels: {
    labelStructure: [mockCategoryTobak, mockCategoryAlkohol, mockCategoryUtgangen],
  },
  statuses: [
    {
      name: 'NEW',
      created: '2025-12-08T14:06:19.288+01:00',
    },
  ],
  roles: [
    {
      name: 'REPORTER',
      displayName: 'Rapportör',
      created: '2025-12-09T09:23:09.485+01:00',
    },
    {
      name: 'PRIMARY',
      displayName: 'Ärendeägare',
      created: '2025-12-09T09:23:09.485+01:00',
    },
    {
      name: 'CONTACT',
      displayName: 'Kontaktperson',
      created: '2025-12-09T09:23:09.485+01:00',
    },
  ],
};
