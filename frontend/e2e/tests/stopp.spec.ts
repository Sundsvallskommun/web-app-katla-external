import type { Page } from '@playwright/test';

import { mockErrand } from '../fixtures/mockErrand';
import { mockMetadata } from '../fixtures/mockMetadata';
import { selectCategorization } from '../utils/categorization';
import { selectErrandOwner } from '../utils/errand-owner';
import { jsonRoute } from '../utils/routes';
import { SERVICE_PATH } from '../utils/service';
import { expect, test } from '../utils/test';

const STOP_TEXT = 'Du kan inte anmäla försäljning av folköl om du varken säljer livsmedel eller tillverkar folköl.';

const yesNo = (title: string) => ({
  type: 'string',
  title,
  oneOf: [
    { const: 'JA', title: 'Ja' },
    { const: 'NEJ', title: 'Nej' },
  ],
});

const schemaWithStop = {
  schemaId: 'stopp-1',
  schema: {
    type: 'object',
    properties: {
      saljerLivsmedel: yesNo('Säljer du livsmedel?'),
      tillverkarFolkol: yesNo('Tillverkar du folköl?'),
    },
    'x-stops': [
      {
        when: {
          properties: { saljerLivsmedel: { const: 'NEJ' }, tillverkarFolkol: { const: 'NEJ' } },
          required: ['saljerLivsmedel', 'tillverkarFolkol'],
        },
        text: STOP_TEXT,
      },
    ],
  },
  uiSchema: {
    saljerLivsmedel: { 'ui:widget': 'RadiobuttonWidget' },
    tillverkarFolkol: { 'ui:widget': 'RadiobuttonWidget' },
  },
};

const answer = (page: Page, question: string, option: 'Ja' | 'Nej') =>
  page.getByRole('group', { name: question }).getByText(option, { exact: true }).click();

test.describe('Stopp', () => {
  test.beforeEach(async ({ appUrl, page }) => {
    await page.route('**/supportmanagement/errand/create', jsonRoute(mockErrand));
    await page.route('**/supportmanagement/metadata', jsonRoute({ ...mockMetadata, namespace: 'AOT' }));
    await page.route('**/schemas/**', jsonRoute(schemaWithStop));
    await page.goto(appUrl(SERVICE_PATH));
    await expect(page.getByTestId('register-errand')).toBeEnabled();
    await selectCategorization(page);
    await selectErrandOwner(page);
  });

  test('explains the stop under the answer and blocks registration until it changes', async ({ page }) => {
    const stop = page.getByTestId('schema-stop');

    await answer(page, 'Säljer du livsmedel?', 'Nej');
    await expect(stop).toHaveCount(0);

    await answer(page, 'Tillverkar du folköl?', 'Nej');
    await expect(stop).toContainText(STOP_TEXT);
    await expect(stop.getByRole('group', { name: 'Tillverkar du folköl?' })).toBeVisible();

    await page.getByTestId('register-errand').click();
    await expect(page.getByText(STOP_TEXT)).toHaveCount(2);
    await expect(page.getByTestId('submit-button')).toBeHidden();

    await answer(page, 'Tillverkar du folköl?', 'Ja');
    await expect(stop).toHaveCount(0);

    await page.getByTestId('register-errand').click();
    await expect(page.getByTestId('submit-button')).toBeEnabled();
  });
});
