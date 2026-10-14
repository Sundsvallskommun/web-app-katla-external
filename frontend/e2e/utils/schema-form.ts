import fs from 'node:fs';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { disclosureByTitle } from './stakeholder';

// The published schemas are authored here; see Formulärscheman in CLAUDE.md.
const MOCKS_DIR = path.resolve(__dirname, '../../../backend/src/mocks');

interface OptionSchema {
  oneOf?: { const: string }[];
  items?: { oneOf?: { const: string }[] };
}

export interface FormSchema {
  properties: Record<string, OptionSchema>;
  'x-attachments'?: { key: string; label: string }[];
  'x-stops'?: { text: string }[];
}

export interface SchemaPair {
  schemaId: string;
  schema: FormSchema;
  uiSchema: Record<string, unknown>;
}

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(MOCKS_DIR, file), 'utf-8'));

/** The schema and ui schema pair as the BFF serves it, keyed by the mock file name. */
export const loadSchemaPair = (name: string): SchemaPair => ({
  schemaId: name,
  schema: readJson(`${name}.schema.json`) as FormSchema,
  uiSchema: readJson(`${name}.ui-schema.json`) as Record<string, unknown>,
});

/**
 * One answer in a form, addressed by the schema property. Nested object members use a dotted path.
 * Rich text is compared without markup, since the editor wraps what is typed in its own tags. A time
 * is stored as RFC 3339 full-time with the browser's offset, so only the clock part is compared.
 */
export type Step =
  | { radio: string; value: string }
  | { check: string; values: string[] }
  | { text: string; value: string }
  | { time: string; value: string }
  | { rich: string; value: string }
  | { row: string; values: Record<string, string> };

export type Answers = Record<string, unknown>;

// RJSF ids: root_<property>, root_<object>_<member>, root_<array>_<row>_<column>, and
// root_<property>-<index> for each radio or checkbox option.
const fieldId = (fieldPath: string): string => `root_${fieldPath.split('.').join('_')}`;

const optionIndex = (schema: FormSchema, field: string, value: string): number => {
  const property = schema.properties[field];
  const options = property?.oneOf ?? property?.items?.oneOf ?? [];
  const index = options.findIndex((option) => option.const === value);
  if (index < 0) throw new Error(`${field} has no option ${value}`);
  return index;
};

const setAnswer = (answers: Answers, fieldPath: string, value: unknown): void => {
  const keys = fieldPath.split('.');
  const last = keys.pop() ?? fieldPath;
  let node = answers;
  for (const key of keys) {
    const child = node[key];
    if (typeof child === 'object' && child !== null) {
      node = child as Answers;
    } else {
      const created: Answers = {};
      node[key] = created;
      node = created;
    }
  }
  node[last] = value;
};

/**
 * Fills the form in the given order and returns the answers the errand should carry. Conditional
 * fields mount only after their controlling answer, so a step that depends on another comes after it.
 */
export const fillSchemaForm = async (page: Page, schema: FormSchema, steps: Step[]): Promise<Answers> => {
  const answers: Answers = {};

  for (const step of steps) {
    if ('radio' in step) {
      await page.locator(`#${fieldId(step.radio)}-${String(optionIndex(schema, step.radio, step.value))}`).check();
      setAnswer(answers, step.radio, step.value);
    } else if ('check' in step) {
      for (const value of step.values) {
        const input = page.locator(`#${fieldId(step.check)}-${String(optionIndex(schema, step.check, value))}`);
        // The design system's checkbox input sits under an overlay; its label takes the click.
        await page.locator('label').filter({ has: input }).click();
        await expect(input).toBeChecked();
      }
      setAnswer(answers, step.check, step.values);
    } else if ('text' in step) {
      await page.locator(`#${fieldId(step.text)}`).fill(step.value);
      setAnswer(answers, step.text, step.value);
    } else if ('time' in step) {
      await page.locator(`#${fieldId(step.time)}`).fill(step.value);
      setAnswer(answers, step.time, expect.stringMatching(new RegExp(`^${step.value}:00[+-]\\d{2}:\\d{2}$`)));
    } else if ('rich' in step) {
      await page.locator(`#${fieldId(step.rich)}`).fill(step.value);
      setAnswer(answers, step.rich, step.value);
    } else {
      const rowId = `${fieldId(step.row)}_0`;
      const [firstColumn] = Object.keys(step.values);
      // A required array already renders its first row.
      if ((await page.locator(`#${rowId}_${firstColumn ?? ''}`).count()) === 0) {
        await page.locator(`#${fieldId(step.row)} button`).click();
      }
      for (const [column, value] of Object.entries(step.values)) {
        await page.locator(`#${rowId}_${column}`).fill(value);
      }
      setAnswer(answers, step.row, [step.values]);
    }
  }

  return answers;
};

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });

export const attachmentsSection = (page: Page): Locator => disclosureByTitle(page, 'Bilagor');

/**
 * Checks that every category is demanded, uploads one file per category and types it, and checks
 * that nothing is reported missing afterwards.
 */
export const uploadRequiredAttachments = async (page: Page, schema: FormSchema, categories: string[]) => {
  const section = attachmentsSection(page);
  const required = section.getByTestId('required-attachments');
  for (const category of categories) {
    const type = schema['x-attachments']?.find((candidate) => candidate.key === category);
    if (!type) throw new Error(`${category} is not an attachment type of the schema`);
    await expect(required).toContainText(`${type.label} (saknas)`);
  }

  await section
    .getByTestId('attachment-upload-field')
    .locator('input[type="file"]')
    .setInputFiles(categories.map((category, index) => pdf(`${category.toLowerCase()}-${String(index)}.pdf`)));
  for (const [index, category] of categories.entries()) {
    await section
      .getByTestId(`attachment-item-${String(index)}`)
      .locator('select')
      .selectOption(category);
  }

  // The list is not rendered at all when nothing is required, so look for the marker page-wide.
  await expect(page.getByText('(saknas)')).toHaveCount(0);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Drops the editor markup around rich text answers so they compare as what was typed. */
export const withoutMarkup = (value: unknown): unknown => {
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, '');
  if (Array.isArray(value)) return value.map(withoutMarkup);
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, withoutMarkup(child)]));
  return value;
};
