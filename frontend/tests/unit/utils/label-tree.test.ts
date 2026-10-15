import { LabelDTO } from '@data-contracts/backend/data-contracts';
import {
  getSelectableLabels,
  getSelectableTypesForCategory,
  getSelectedLabels,
  toErrandLabels,
} from '@utils/label-tree';
import { describe, expect, it } from 'vitest';

const label = (id: string, classification: string, overrides: Partial<LabelDTO> = {}): LabelDTO => ({
  id,
  classification,
  displayName: id,
  resourceName: id.toUpperCase(),
  resourcePath: id.toUpperCase(),
  ...overrides,
});

const stadigvarande = label('stadigvarande', 'SUBTYPE');
const tillfalligt = label('tillfalligt', 'SUBTYPE', { deprecated: true });
const servering = label('servering', 'TYPE', { labels: [stadigvarande, tillfalligt] });
const folkol = label('folkol', 'TYPE');
const utgangen = label('utgangen', 'TYPE', { deprecated: true, labels: [label('gammal', 'SUBTYPE')] });
const alkohol = label('alkohol', 'CATEGORY', { labels: [servering, folkol, utgangen] });

describe('getSelectedLabels', () => {
  it('reads the whole path off the errand', () => {
    const selected = getSelectedLabels([
      { id: 'alkohol', classification: 'CATEGORY' },
      { id: 'servering', classification: 'TYPE' },
      { id: 'stadigvarande', classification: 'SUBTYPE' },
    ]);

    expect([selected.CATEGORY?.id, selected.TYPE?.id, selected.SUBTYPE?.id]).toEqual([
      'alkohol',
      'servering',
      'stadigvarande',
    ]);
  });

  it('accepts a leaf type filed without a subtype', () => {
    const selected = getSelectedLabels([
      { id: 'alkohol', classification: 'CATEGORY' },
      { id: 'folkol', classification: 'TYPE' },
    ]);

    expect(selected.TYPE?.id).toBe('folkol');
    expect(selected.SUBTYPE).toBeUndefined();
  });

  it('ignores levels whose parent is missing, since the subtree they name is unreachable', () => {
    expect(getSelectedLabels([{ id: 'servering', classification: 'TYPE' }])).toEqual({});
    expect(
      getSelectedLabels([
        { id: 'alkohol', classification: 'CATEGORY' },
        { id: 'stadigvarande', classification: 'SUBTYPE' },
      ]).SUBTYPE
    ).toBeUndefined();
  });

  it('treats an unclassified errand as nothing selected', () => {
    expect(getSelectedLabels(undefined)).toEqual({});
    expect(getSelectedLabels([])).toEqual({});
  });
});

describe('getSelectableLabels', () => {
  it('drops deprecated labels', () => {
    expect(getSelectableLabels([servering, tillfalligt]).map((l) => l.id)).toEqual(['servering']);
  });

  it('keeps a deprecated label the errand already carries, so its classification still shows', () => {
    expect(getSelectableLabels([servering, tillfalligt], [tillfalligt.id]).map((l) => l.id)).toEqual([
      'servering',
      'tillfalligt',
    ]);
  });
});

describe('getSelectableTypesForCategory', () => {
  it('inlines only the selectable subtypes under each type', () => {
    const types = getSelectableTypesForCategory(alkohol);

    expect(types.map((type) => type.id)).toEqual(['servering', 'folkol']);
    expect(types[0].labels?.map((subtype) => subtype.id)).toEqual(['stadigvarande']);
    expect(types[1].labels).toEqual([]);
  });

  it('hides a type left without a selectable leaf', () => {
    const onlyDeprecatedSubtypes = label('tomt', 'TYPE', { labels: [tillfalligt] });
    const category = label('kategori', 'CATEGORY', { labels: [onlyDeprecatedSubtypes] });

    expect(getSelectableTypesForCategory(category)).toEqual([]);
  });

  it('keeps a deprecated branch the errand is classified with', () => {
    const types = getSelectableTypesForCategory(alkohol, ['utgangen']);

    expect(types.map((type) => type.id)).toEqual(['servering', 'folkol', 'utgangen']);
    // Nothing new may be picked below a deprecated type.
    expect(types[2].labels).toEqual([]);
  });

  it('offers nothing beyond the labels the errand already carries under a deprecated category', () => {
    const deprecatedCategory = label('tobak', 'CATEGORY', { deprecated: true, labels: [servering, folkol] });

    expect(getSelectableTypesForCategory(deprecatedCategory).map((type) => type.id)).toEqual([]);
    expect(getSelectableTypesForCategory(deprecatedCategory, ['folkol']).map((type) => type.id)).toEqual(['folkol']);
  });
});

describe('toErrandLabels', () => {
  it('stores the path without the subtree hanging off it', () => {
    expect(toErrandLabels(alkohol, servering, stadigvarande)).toEqual([
      {
        id: 'alkohol',
        classification: 'CATEGORY',
        displayName: 'alkohol',
        resourceName: 'ALKOHOL',
        resourcePath: 'ALKOHOL',
      },
      {
        id: 'servering',
        classification: 'TYPE',
        displayName: 'servering',
        resourceName: 'SERVERING',
        resourcePath: 'SERVERING',
      },
      {
        id: 'stadigvarande',
        classification: 'SUBTYPE',
        displayName: 'stadigvarande',
        resourceName: 'STADIGVARANDE',
        resourcePath: 'STADIGVARANDE',
      },
    ]);
  });

  it('files a leaf type as two labels', () => {
    expect(toErrandLabels(alkohol, folkol).map((l) => l.classification)).toEqual(['CATEGORY', 'TYPE']);
  });

  it('files a category on its own while the type is still unanswered', () => {
    expect(toErrandLabels(alkohol).map((l) => l.classification)).toEqual(['CATEGORY']);
  });
});
