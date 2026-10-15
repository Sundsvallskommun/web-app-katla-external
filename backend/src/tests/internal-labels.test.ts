import { describe, expect, it } from 'vitest';

import { ErrandLabel, Label, LabelAttribute } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { assertLabelsOffered, labelsChanged, withoutInternalOnly } from '@/utils/internal-labels';

const INTERNAL: LabelAttribute[] = [{ key: 'internalOnly', value: 'true' }];

const label = (classification: string, resourcePath: string, children: Label[] = [], attributes?: LabelAttribute[]): Label => ({
  id: `id-${resourcePath}`,
  classification,
  resourceName: resourcePath.split('/').at(-1) ?? resourcePath,
  resourcePath,
  labels: children,
  attributes,
});

const errandLabel = (resourcePath: string): ErrandLabel => ({ id: `id-${resourcePath}`, resourcePath });

const tree = (): Label[] => [
  label('CATEGORY', 'CATEGORYROOT/ALCOHOL', [
    label('TYPE', 'CATEGORYROOT/ALCOHOL/SERVING', [label('SUBTYPE', 'CATEGORYROOT/ALCOHOL/SERVING/PERMANENT')]),
    label('TYPE', 'CATEGORYROOT/ALCOHOL/INSPECTION', [label('SUBTYPE', 'CATEGORYROOT/ALCOHOL/INSPECTION/PLANNED')], INTERNAL),
  ]),
  label('CATEGORY', 'CATEGORYROOT/DOCUMENTATION', [label('TYPE', 'CATEGORYROOT/DOCUMENTATION/TIP')], INTERNAL),
];

const pathsOf = (labels: Label[]): string[] => labels.flatMap(l => [l.resourcePath ?? '', ...pathsOf(l.labels ?? [])]);

describe('withoutInternalOnly', () => {
  it('drops an internal type with its subtree and keeps its siblings', () => {
    const paths = pathsOf(withoutInternalOnly(tree()));

    expect(paths).toContain('CATEGORYROOT/ALCOHOL/SERVING/PERMANENT');
    expect(paths.some(path => path.includes('INSPECTION'))).toBe(false);
  });

  it('drops an internal category with everything below it', () => {
    expect(pathsOf(withoutInternalOnly(tree())).some(path => path.includes('DOCUMENTATION'))).toBe(false);
  });

  it.each([
    ['value false', [{ key: 'internalOnly', value: 'false' }]],
    ['another casing of the value', [{ key: 'internalOnly', value: 'TRUE' }]],
    ['another key', [{ key: 'processStartMode', value: 'MANUAL' }]],
    ['no attributes', undefined],
  ])('keeps a label with %s', (_case, attributes) => {
    const labels = [label('CATEGORY', 'CATEGORYROOT/TOBACCO', [], attributes)];

    expect(withoutInternalOnly(labels)).toEqual(labels);
  });

  it('drops a parent whose children are all internal, since nothing below it could be chosen', () => {
    const labels = [label('CATEGORY', 'CATEGORYROOT/TOBACCO', [label('TYPE', 'CATEGORYROOT/TOBACCO/INSPECTION', [], INTERNAL)])];

    expect(withoutInternalOnly(labels)).toEqual([]);
  });

  it('does not mutate the upstream tree', () => {
    const labels = tree();
    withoutInternalOnly(labels);

    expect(labels[0]?.labels).toHaveLength(2);
  });
});

describe('assertLabelsOffered', () => {
  const offered = withoutInternalOnly(tree());

  it('accepts labels from the offered tree', () => {
    expect(() => {
      assertLabelsOffered(
        [errandLabel('CATEGORYROOT/ALCOHOL'), errandLabel('CATEGORYROOT/ALCOHOL/SERVING'), errandLabel('CATEGORYROOT/ALCOHOL/SERVING/PERMANENT')],
        offered,
      );
    }).not.toThrow();
  });

  it.each([
    ['an internal label', errandLabel('CATEGORYROOT/ALCOHOL/INSPECTION')],
    ['a label below an internal one', errandLabel('CATEGORYROOT/ALCOHOL/INSPECTION/PLANNED')],
    ['an unknown label', errandLabel('CATEGORYROOT/ALCOHOL/NONE')],
    ['a label without id', { resourcePath: 'CATEGORYROOT/ALCOHOL' }],
    ['an offered id with a foreign resourcePath', { id: 'id-CATEGORYROOT/ALCOHOL', resourcePath: 'CATEGORYROOT/ALCOHOL/INSPECTION' }],
  ])('rejects %s with the same 400', (_case, submitted) => {
    expect(() => {
      assertLabelsOffered([errandLabel('CATEGORYROOT/ALCOHOL'), submitted], offered);
    }).toThrow(expect.objectContaining<Partial<HttpException>>({ status: 400, message: 'Label is not available' }));
  });
});

describe('labelsChanged', () => {
  it('ignores order', () => {
    expect(labelsChanged([errandLabel('A'), errandLabel('B')], [errandLabel('B'), errandLabel('A')])).toBe(false);
  });

  it('sees a swapped label', () => {
    expect(labelsChanged([errandLabel('A'), errandLabel('B')], [errandLabel('A'), errandLabel('C')])).toBe(true);
  });
});
