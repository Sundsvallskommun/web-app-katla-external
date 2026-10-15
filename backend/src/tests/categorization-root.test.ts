import { describe, expect, it } from 'vitest';

import { Label } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { selectCategorizationSubtree, withCategorizationSubtree } from '@/utils/categorization-root';

const type = (resourceName: string, parentPath: string): Label => ({
  classification: 'TYPE',
  resourceName,
  resourcePath: `${parentPath}/${resourceName}`,
  labels: [],
});

const category = (resourceName: string, types: string[]): Label => ({
  classification: 'CATEGORY',
  resourceName,
  resourcePath: `CATEGORYROOT/${resourceName}`,
  labels: types.map(name => type(name, `CATEGORYROOT/${resourceName}`)),
});

/**
 * Shaped after docs/label-structure.json: the categorization root, the free-tag root that shares
 * its classification, and a deprecated legacy sibling.
 */
const labelStructure = (): Label[] => [
  {
    classification: 'ROOT',
    resourceName: 'CATEGORYROOT',
    resourcePath: 'CATEGORYROOT',
    labels: [category('ALCOHOL', ['SERVING_PERMIT_APPLICATION', 'INSPECTION']), category('TOBACCO', ['INSPECTION'])],
  },
  {
    classification: 'ROOT',
    resourceName: 'TAGROOT',
    resourcePath: 'TAGROOT',
    labels: [{ classification: 'CATEGORY', resourceName: 'ALCOHOL_INSPECTION', resourcePath: 'TAGROOT/ALCOHOL_INSPECTION', labels: [] }],
  },
  {
    classification: 'CATEGORY',
    resourceName: 'UNCATEGORIZED',
    resourcePath: 'UNCATEGORIZED',
    labels: [type('UNCATEGORIZED', 'UNCATEGORIZED')],
  },
];

describe('categorization root', () => {
  it('returns the children of the categorization root as the tree', () => {
    const subtree = selectCategorizationSubtree(labelStructure());

    expect(subtree.map(label => label.resourceName)).toEqual(['ALCOHOL', 'TOBACCO']);
    expect(subtree.every(label => label.classification === 'CATEGORY')).toBe(true);
  });

  it('drops the UNCATEGORIZED sibling that lives outside the root', () => {
    const subtree = selectCategorizationSubtree(labelStructure());

    expect(JSON.stringify(subtree)).not.toContain('UNCATEGORIZED');
  });

  // The free-tag root carries the same classification, so classification alone cannot find the
  // categorization root.
  it('picks the categorization root and not the free-tag root beside it', () => {
    const subtree = selectCategorizationSubtree(labelStructure());

    expect(subtree.map(label => label.resourceName)).toEqual(['ALCOHOL', 'TOBACCO']);
    expect(JSON.stringify(subtree)).not.toContain('TAGROOT');
  });

  it('keeps the upstream resourcePath so a stored label still carries its full path', () => {
    const [alcohol] = selectCategorizationSubtree(labelStructure());

    expect(alcohol?.resourcePath).toBe('CATEGORYROOT/ALCOHOL');
    expect(alcohol?.labels?.[0]?.resourcePath).toBe('CATEGORYROOT/ALCOHOL/SERVING_PERMIT_APPLICATION');
  });

  it.each([
    ['no root', []],
    ['no label structure', undefined],
  ])('fails closed with %s rather than returning an empty tree', (_case, structure) => {
    expect(() => selectCategorizationSubtree(structure as Label[] | undefined)).toThrow(
      expect.objectContaining<Partial<HttpException>>({ status: 502 }),
    );
  });

  it('fails closed when the categorization root itself appears twice', () => {
    const structure = labelStructure();
    structure.push({ classification: 'ROOT', resourceName: 'CATEGORYROOT', resourcePath: 'CATEGORYROOT', labels: [] });

    expect(() => selectCategorizationSubtree(structure)).toThrow(/found 2/);
  });

  it('accepts the three levels the categorization UI renders', () => {
    // The real tree (docs/label-structure.json) is CATEGORY -> TYPE -> SUBTYPE, exactly at the limit.
    const structure = labelStructure();
    const servingPermit = structure[0]?.labels?.[0]?.labels?.[0];
    if (!servingPermit) throw new Error('fixture lost its type label');
    servingPermit.labels = [
      {
        classification: 'SUBTYPE',
        resourceName: 'PERMANENT_SERVING',
        resourcePath: 'CATEGORYROOT/ALCOHOL/SERVING_PERMIT_APPLICATION/PERMANENT_SERVING',
        labels: [],
      },
    ];

    const subtree = selectCategorizationSubtree(structure);

    expect(subtree[0]?.labels?.[0]?.labels?.[0]?.resourceName).toBe('PERMANENT_SERVING');
  });

  it('fails closed when the tree is deeper than the categorization UI can render', () => {
    const structure = labelStructure();
    const deepest = structure[0]?.labels?.[0]?.labels?.[0];
    if (!deepest) throw new Error('fixture lost its type label');
    deepest.labels = [{ classification: 'SUBTYPE', resourceName: 'A', labels: [{ classification: 'SUBTYPE', resourceName: 'B', labels: [] }] }];

    expect(() => selectCategorizationSubtree(structure)).toThrow(/4 levels deep/);
  });

  it('passes every other metadata section through untouched', () => {
    const metadata = {
      labels: { labelStructure: labelStructure() },
      roles: [{ name: 'PRIMARY' }],
      statuses: [{ name: 'NEW' }],
      categories: [{ name: 'CATEGORY' }],
    };

    const result = withCategorizationSubtree(metadata);

    expect(result.roles).toBe(metadata.roles);
    expect(result.statuses).toBe(metadata.statuses);
    expect(result.categories).toBe(metadata.categories);
    expect(result.labels?.labelStructure).toHaveLength(2);
  });
});

describe('internal-only labels in the categorization tree', () => {
  it('leaves internal-only labels out of the offered tree', () => {
    const structure = labelStructure();
    const inspection = structure[0]?.labels?.[0]?.labels?.[1];
    if (!inspection) throw new Error('fixture lost its inspection label');
    inspection.attributes = [{ key: 'internalOnly', value: 'true' }];

    const [alcohol] = selectCategorizationSubtree(structure);

    expect(alcohol?.labels?.map(label => label.resourceName)).toEqual(['SERVING_PERMIT_APPLICATION']);
  });

  it('checks depth on the offered tree, so a too deep internal branch does not fail the metadata', () => {
    const structure = labelStructure();
    const inspection = structure[0]?.labels?.[0]?.labels?.[1];
    if (!inspection) throw new Error('fixture lost its inspection label');
    inspection.attributes = [{ key: 'internalOnly', value: 'true' }];
    inspection.labels = [{ classification: 'SUBTYPE', resourceName: 'A', labels: [{ classification: 'SUBTYPE', resourceName: 'B', labels: [] }] }];

    expect(() => selectCategorizationSubtree(structure)).not.toThrow();
  });
});
