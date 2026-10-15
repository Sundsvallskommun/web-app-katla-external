import type { Request } from '@playwright/test';

import { mockErrand } from '../fixtures/mockErrand';
import { mockMetadata } from '../fixtures/mockMetadata';
import { selectCategorization } from '../utils/categorization';
import { selectErrandOwner } from '../utils/errand-owner';
import { jsonRoute } from '../utils/routes';
import { SERVICE_PATH } from '../utils/service';
import { disclosureByTitle } from '../utils/stakeholder';
import { expect, test } from '../utils/test';

const schemaWithPowerOfAttorney = {
  schemaId: 'bilagor-1',
  schema: {
    type: 'object',
    properties: {},
    'x-attachments': [{ key: 'POWER_OF_ATTORNEY', label: 'Fullmakt', requiredWhen: {} }],
  },
  uiSchema: {},
};

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });

const isAttachmentUpload = (request: Request) =>
  request.method() === 'POST' && /\/supportmanagement\/errand\/[^/]+\/attachments$/.test(request.url());

test.describe('Bilagor', () => {
  test.beforeEach(async ({ appUrl, page }) => {
    await page.route('**/supportmanagement/errand/create', jsonRoute(mockErrand));
    // The namespace is what maps the errand type to its schema.
    await page.route('**/supportmanagement/metadata', jsonRoute({ ...mockMetadata, namespace: 'AOT' }));
    await page.route('**/schemas/**', jsonRoute(schemaWithPowerOfAttorney));
    await page.goto(appUrl(SERVICE_PATH));
    await expect(page.getByTestId('register-errand')).toBeEnabled();
  });

  test('takes several files of the same type and sends each of them', async ({ page }) => {
    await page.route('**/supportmanagement/errand/*/attachments', (route) =>
      route.request().method() === 'POST' ? jsonRoute({ message: 'success' }, 201)(route) : jsonRoute([])(route)
    );
    await selectCategorization(page);
    await selectErrandOwner(page);

    const section = disclosureByTitle(page, 'Bilagor');
    await section
      .getByTestId('attachment-upload-field')
      .locator('input[type="file"]')
      .setInputFiles([pdf('fullmakt-1.pdf'), pdf('fullmakt-2.pdf'), pdf('fullmakt-3.pdf')]);

    const required = section.getByTestId('required-attachments');
    await expect(required).toContainText('Fullmakt (saknas)');

    for (const index of [0, 1, 2]) {
      await section
        .getByTestId(`attachment-item-${String(index)}`)
        .locator('select')
        .selectOption('POWER_OF_ATTORNEY');
    }
    await expect(required).toContainText('Fullmakt');
    await expect(required).not.toContainText('saknas');

    await section.getByTestId('attachment-item-2').getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Ta bort' }).click();
    await expect(section.getByTestId('attachment-item-2')).toHaveCount(0);

    const uploads: Request[] = [];
    page.on('request', (request) => {
      if (isAttachmentUpload(request)) uploads.push(request);
    });
    await page.getByTestId('save-draft-errand').click();

    await expect.poll(() => uploads.length).toBe(2);
    for (const upload of uploads) {
      expect(upload.postData()).toContain('name="category"\r\n\r\nPOWER_OF_ATTORNEY');
    }
  });
});
