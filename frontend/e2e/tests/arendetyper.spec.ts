import type { Page, Request } from '@playwright/test';

import { mockErrand } from '../fixtures/mockErrand';
import { mockMetadata } from '../fixtures/mockMetadata';
import { branches, happyPaths, type SchemaCase } from '../fixtures/schemaCases';
import { selectCategorization } from '../utils/categorization';
import { selectErrandOwner } from '../utils/errand-owner';
import { jsonRoute } from '../utils/routes';
import {
  fillSchemaForm,
  loadSchemaPair,
  type SchemaPair,
  uploadRequiredAttachments,
  withoutMarkup,
} from '../utils/schema-form';
import { SERVICE_PATH } from '../utils/service';
import { expect, test } from '../utils/test';

interface CreateErrandRequestBody {
  jsonParameters?: { key: string; value: unknown; schemaId: string }[];
}

const isAttachmentUpload = (request: Request) =>
  request.method() === 'POST' && /\/supportmanagement\/errand\/[^/]+\/attachments$/.test(request.url());

const attachmentCategory = (request: Request): string =>
  /name="category"\r\n\r\n([A-Z_]+)/.exec(request.postData() ?? '')?.[1] ?? '';

/**
 * Serves one published schema for whatever errand type the metadata maps, so the categorization
 * helper can stay the same while every schema gets its turn.
 */
const openFormWithSchema = async (page: Page, appUrl: (path: string) => string, pair: SchemaPair) => {
  await page.route('**/supportmanagement/errand/create', jsonRoute(mockErrand));
  await page.route('**/supportmanagement/metadata', jsonRoute({ ...mockMetadata, namespace: 'AOT' }));
  await page.route('**/schemas/**', jsonRoute(pair));
  await page.route('**/supportmanagement/errand/*/attachments', (route) =>
    route.request().method() === 'POST' ? jsonRoute({ message: 'success' }, 201)(route) : jsonRoute([])(route)
  );
  await page.goto(appUrl(SERVICE_PATH));
  await expect(page.getByTestId('register-errand')).toBeEnabled();
  await selectCategorization(page);
  await selectErrandOwner(page);
};

const register = async (page: Page): Promise<CreateErrandRequestBody> => {
  await page.getByTestId('register-errand').click();
  const submitButton = page.getByTestId('submit-button');
  await expect(submitButton).toBeEnabled();
  const createRequest = page.waitForRequest(
    (request) => request.url().includes('/supportmanagement/errand/create') && request.method() === 'POST'
  );
  await submitButton.click();
  const request = await createRequest;
  expect((await request.response())?.status()).toBe(200);
  return request.postDataJSON() as CreateErrandRequestBody;
};

const registersWithSchema =
  (schemaCase: SchemaCase) =>
  async ({ appUrl, page }: { appUrl: (path: string) => string; page: Page }) => {
    const pair = loadSchemaPair(schemaCase.schema);
    await openFormWithSchema(page, appUrl, pair);
    const uploads: Request[] = [];
    page.on('request', (request) => {
      if (isAttachmentUpload(request)) uploads.push(request);
    });

    const expected = await fillSchemaForm(page, pair.schema, schemaCase.steps);
    await uploadRequiredAttachments(page, pair.schema, schemaCase.attachments);
    const body = await register(page);

    expect(body.jsonParameters).toHaveLength(1);
    const [filed] = body.jsonParameters ?? [];
    expect(filed?.schemaId).toBe(pair.schemaId);
    const answers = withoutMarkup(filed?.value) as Record<string, unknown>;
    expect(answers).toMatchObject(expected);
    for (const property of schemaCase.absent ?? []) {
      expect(answers).not.toHaveProperty(property);
    }

    await expect.poll(() => uploads.length).toBe(schemaCase.attachments.length);
    expect(uploads.map(attachmentCategory).sort()).toEqual([...schemaCase.attachments].sort());
  };

test.describe('Ärendetyper', () => {
  for (const schemaCase of happyPaths) {
    test(`registrerar ${schemaCase.title}`, registersWithSchema(schemaCase));
  }

  test.describe('andra grenar', () => {
    for (const schemaCase of branches) {
      test(schemaCase.title, registersWithSchema(schemaCase));
    }

    test('catering utan mat stoppas tills svaret ändras', async ({ appUrl, page }) => {
      // Everything else complete, so the stop is the only thing holding registration back.
      const catering = happyPaths.find((candidate) => candidate.schema.endsWith('permanent-catering'));
      if (!catering) throw new Error('catering case missing');
      const pair = loadSchemaPair(catering.schema);
      await openFormWithSchema(page, appUrl, pair);
      await fillSchemaForm(page, pair.schema, catering.steps);
      await uploadRequiredAttachments(page, pair.schema, catering.attachments);
      const stopText = pair.schema['x-stops']?.[0]?.text ?? '';
      expect(stopText).not.toBe('');

      const stop = page.getByTestId('schema-stop');
      await fillSchemaForm(page, pair.schema, [{ radio: 'serverasMat', value: 'NEJ' }]);
      await expect(stop).toContainText(stopText);
      await page.getByTestId('register-errand').click();
      // Inline under the answer and once more as the toast.
      await expect(page.getByText(stopText)).toHaveCount(2);
      await expect(page.getByTestId('submit-button')).toBeHidden();

      await fillSchemaForm(page, pair.schema, [{ radio: 'serverasMat', value: 'JA' }]);
      await expect(stop).toHaveCount(0);
    });
  });
});
