import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFormSchemaValidator } from '@components/json/schema/form-schema-validator';
import { getConditionalFields } from '@components/json/utils/schema-conditions';
import { jsonWidgets } from '@components/json/widgets';
import type { RJSFSchema } from '@rjsf/utils';
import { attachmentTypesOfSchema } from '@utils/errand-attachments';
import { stopsOfSchema } from '@utils/schema-stops';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract test between the renderer and the schemas the BFF serves. The generator that once
 * refused to emit a broken pair is retired, so this is what stands between a schema edit and the
 * citizen. It runs against the mocked pairs in backend/src/mocks; once the schemas live in the
 * jsonschema service, point it at the published versions instead.
 */

const mocksDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../backend/src/mocks');

const schemaFiles = fs
  .readdirSync(mocksDir)
  .filter((file) => file.endsWith('.schema.json'))
  .sort();

const loadJson = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(mocksDir, file), 'utf-8'));

const pairs = schemaFiles.map((file) => ({
  file,
  schema: loadJson(file) as RJSFSchema,
  uiSchema: loadJson(file.replace('.schema.json', '.ui-schema.json')) as Record<string, unknown>,
}));

const collectWidgetNames = (node: unknown, found: Set<string>): void => {
  if (typeof node !== 'object' || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'ui:widget' && typeof value === 'string') found.add(value);
    collectWidgetNames(value, found);
  }
};

const objectSchemas = (schema: RJSFSchema): RJSFSchema[] => {
  const collected: RJSFSchema[] = [schema];
  for (const child of Object.values(schema.properties ?? {})) {
    if (typeof child !== 'object' || child === null) continue;
    if (child.type === 'object') collected.push(...objectSchemas(child));
    if (
      child.type === 'array' &&
      typeof child.items === 'object' &&
      !Array.isArray(child.items) &&
      child.items.type === 'object'
    ) {
      collected.push(...objectSchemas(child.items));
    }
  }
  return collected;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mocked schema pairs against the renderer contract', () => {
  it('finds the mocked pairs', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(10);
  });

  describe.each(pairs)('$file', ({ file, schema, uiSchema }) => {
    it('compiles with the real form validator', () => {
      const validator = getFormSchemaValidator(file);
      // A schema AJV cannot compile does not throw here — the failure surfaces as an error whose
      // stack carries the compile message instead of a field path.
      const result = validator.validateFormData({}, schema);
      expect(result.errors.filter((error) => error.stack.includes('no schema with key or ref'))).toEqual([]);
    });

    it('uses only widget names the registry resolves', () => {
      const used = new Set<string>();
      collectWidgetNames(uiSchema, used);
      for (const name of used) {
        expect(Object.keys(jsonWidgets), `unresolved widget '${name}'`).toContain(name);
      }
    });

    it('places every root property in exactly one section', () => {
      const sections = (uiSchema['ui:sections'] ?? []) as { id: string; fields: string[] }[];
      const sectioned = sections.flatMap((section) => section.fields);
      const propertyNames = Object.keys(schema.properties ?? {});

      expect(new Set(sectioned).size, 'a field appears in more than one section').toBe(sectioned.length);
      expect([...sectioned].sort(), 'sections and schema properties must partition each other').toEqual(
        [...propertyNames].sort()
      );
    });

    it('uses only condition keywords the renderer understands', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      for (const objectSchema of objectSchemas(schema)) getConditionalFields(objectSchema);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('declares only well-formed x-attachments entries', () => {
      const declared = (schema as Record<string, unknown>)['x-attachments'];
      if (!Array.isArray(declared)) return;
      // attachmentTypesOfSchema silently drops malformed entries; nothing may be dropped here.
      expect(attachmentTypesOfSchema(schema as Record<string, unknown>)).toHaveLength(declared.length);
    });

    it('declares only well-formed x-stops on root properties', () => {
      const declared = (schema as Record<string, unknown>)['x-stops'];
      if (!Array.isArray(declared)) return;
      const stops = stopsOfSchema(schema);
      expect(stops).toHaveLength(declared.length);

      const root = Object.keys(schema.properties ?? {});
      for (const { when } of stops) {
        expect(root).toEqual(expect.arrayContaining([...Object.keys(when.properties ?? {}), ...(when.required ?? [])]));
      }
    });

    // Alcohol schemas say premises and tobacco schemas point of sale, as the PartyAsset schemas do.
    const site = file.startsWith('aot-tobacco') ? 'pointOfSale' : 'premises';
    const otherSite = site === 'premises' ? 'pointOfSale' : 'premises';

    // Draken reads the premises address from this one key in every schema of the domain.
    it(`keeps the premises address in the root ${site}Address object`, () => {
      const root = schema.properties ?? {};
      const invoiceRecipient = root.invoiceRecipient;
      const holders = objectSchemas(schema).filter(
        (object) => object.properties?.street !== undefined && object !== invoiceRecipient
      );
      const address = root[`${site}Address`];

      if (root[`${site}AddressSameAsCompany`] !== undefined) expect(address).toBeDefined();
      if (typeof address !== 'object') {
        expect(holders).toEqual([]);
        return;
      }

      expect(holders).toEqual([address]);
      expect(address.required).toEqual(expect.arrayContaining(['street', 'postalCode', 'city']));

      if (root[`${site}AddressSameAsCompany`] === undefined) {
        expect(schema.required).toContain(`${site}Address`);
      } else {
        expect(schema.allOf).toContainEqual({
          if: {
            properties: { [`${site}AddressSameAsCompany`]: { const: 'NO' } },
            required: [`${site}AddressSameAsCompany`],
          },
          then: { required: [`${site}Address`] },
        });
      }
    });

    // The decision tab in Draken reads these premises fields by key; docs/beslutsflik-nycklar.md.
    describe('keeps the premises keys Draken reads canonical', () => {
      const root = (schema.properties ?? {}) as Record<string, RJSFSchema>;
      const rootObjects = Object.entries(root).filter(([, child]) => child.type === 'object');
      const propertyNames = (object: RJSFSchema) => Object.keys(object.properties ?? {});

      it(`names the premises in a root ${site}Name string`, () => {
        const premisesKeys = ['Name', 'AddressSameAsCompany', 'Address', 'Contact'];
        for (const suffix of premisesKeys) expect(root[`${otherSite}${suffix}`]).toBeUndefined();
        const name = root[`${site}Name`];
        if (name !== undefined) expect(name.type).toBe('string');
      });

      it(`keeps contact details in ${site}Contact only`, () => {
        const contactFields = ['phoneNumber', 'emailAddress', 'website'];
        for (const [name, object] of rootObjects) {
          const held = propertyNames(object).filter((field) => contactFields.includes(field));
          if (name === `${site}Contact`) {
            expect(propertyNames(object)).toEqual(held);
          } else {
            expect(held, `${name} carries contact fields`).toEqual([]);
          }
        }
      });

      it('counts seats under seating with the shared child names', () => {
        const holders = objectSchemas(schema).filter((object) =>
          propertyNames(object).some((field) => field.startsWith('seats'))
        );
        if (root.seating === undefined) {
          expect(holders).toEqual([]);
          return;
        }
        expect(holders).toEqual([root.seating]);
        for (const field of propertyNames(root.seating)) {
          expect(['seatsIndoor', 'seatsOutdoor']).toContain(field);
        }
      });

      it('lists the drinks under beverages', () => {
        const drinkKeys = Object.keys(root).filter((field) => /beverages$/i.test(field));
        expect(drinkKeys.length).toBeLessThanOrEqual(1);
        if (drinkKeys.length === 0) return;
        expect(drinkKeys).toEqual(['beverages']);
        const items = root.beverages.items as RJSFSchema;
        expect(items.oneOf?.map((option) => (option as RJSFSchema).const)).toEqual([
          'STRONG_BEER',
          'WINE',
          'SPIRITS',
          'OTHER_FERMENTED_BEVERAGES',
        ]);
      });

      it('describes the menu as servesFood, menuChoice and menuDescription', () => {
        if (root.menuChoice === undefined) {
          expect(root.menuDescription).toBeUndefined();
          return;
        }
        expect(root.menuChoice.oneOf?.map((option) => (option as RJSFSchema).const).sort()).toEqual([
          'DESCRIBE',
          'UPLOAD',
        ]);
        expect(root.menuDescription.type).toBe('string');
        const menu = attachmentTypesOfSchema(schema as Record<string, unknown>).find((type) => type.key === 'MENU');
        expect(menu?.requiredWhen).toEqual({
          properties: { menuChoice: { const: 'UPLOAD' } },
          required: ['menuChoice'],
        });
      });

      it('lists responsible staff under responsibleServingStaff', () => {
        const staffShape = ['firstName', 'lastName', 'dateOfBirth', 'fromDate'];
        const holders = Object.entries(root).filter(([, child]) => {
          const items =
            child.type === 'array' && typeof child.items === 'object' ? (child.items as RJSFSchema) : undefined;
          return items !== undefined && [...propertyNames(items)].sort().join() === [...staffShape].sort().join();
        });
        for (const [name] of holders) expect(name).toBe('responsibleServingStaff');
      });
    });
  });

  it('flags a schema declaring draft-07, proving the compile check bites', () => {
    const validator = getFormSchemaValidator('contract-test-draft-07');
    const draft07 = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object' } as RJSFSchema;
    const result = validator.validateFormData({}, draft07);
    expect(result.errors.some((error) => error.stack.includes('no schema with key or ref'))).toBe(true);
  });
});
