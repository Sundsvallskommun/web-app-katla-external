import { schemaNamesForErrand } from '@components/json/utils/schema-utils';
import type { ErrandLabelDTO } from '@data-contracts/backend/data-contracts';
import { describe, expect, it } from 'vitest';

const label = (classification: string, resourceName: string): ErrandLabelDTO => ({ classification, resourceName });

const CATEGORY = label('CATEGORY', 'ALCOHOL');
const TYPE = label('TYPE', 'SERVING_PERMIT_APPLICATION');
const SUBTYPE = label('SUBTYPE', 'PERMANENT_SERVING');

describe('schema names', () => {
  it('names a schema after the namespace and the whole categorization path', () => {
    expect(schemaNamesForErrand([CATEGORY, TYPE, SUBTYPE], 'AOT')).toEqual([
      'aot_alcohol_serving_permit_application_permanent_serving',
    ]);
  });

  it('stops at the type when it is the leaf', () => {
    expect(schemaNamesForErrand([CATEGORY, label('TYPE', 'FOLKOL_SERVING_NOTIFICATION')], 'AOT')).toEqual([
      'aot_alcohol_folkol_serving_notification',
    ]);
  });

  /**
   * The whole path, not the leaf: the jsonschema service partitions by municipality only, so a
   * leaf name that repeats under another parent would resolve to one and the same schema.
   */
  it('keeps two identically named leaves apart by their parents', () => {
    const underAlcohol = schemaNamesForErrand([CATEGORY, label('TYPE', 'STADIGVARANDE')], 'AOT');
    const underTobacco = schemaNamesForErrand([label('CATEGORY', 'TOBACCO'), label('TYPE', 'STADIGVARANDE')], 'AOT');

    expect(underAlcohol).not.toEqual(underTobacco);
  });

  it('keeps two apps apart by their namespace', () => {
    expect(schemaNamesForErrand([CATEGORY, TYPE, SUBTYPE], 'HEALTHCAREDEVIATIONVOF')).toEqual([
      'healthcaredeviationvof_alcohol_serving_permit_application_permanent_serving',
    ]);
  });

  it('selects no schema before the errand type is chosen', () => {
    expect(schemaNamesForErrand(undefined, 'AOT')).toEqual([]);
    expect(schemaNamesForErrand([CATEGORY], 'AOT')).toEqual([]);
  });

  it('selects no schema without a namespace to qualify the name', () => {
    expect(schemaNamesForErrand([CATEGORY, TYPE, SUBTYPE], undefined)).toEqual([]);
  });
});
