import { mockMetadata } from '../fixtures/mockMetadata';
import { emptyRoute, jsonRoute } from '../utils/routes';
import { expect, test } from '../utils/test';

test.describe('Start page', () => {
  test('lists the alcohol and tobacco service and opens its registration form', async ({ appUrl, page }) => {
    await page.route('**/supportmanagement/metadata', jsonRoute(mockMetadata));
    // 404 is the errand type having no form yet, not a failure.
    await page.route('**/schemas/**', emptyRoute(404));
    await page.goto(appUrl(''));

    await expect(page.locator('h1')).toContainText('E-tjänster');
    await page.getByTestId('service-link-alkoholtillstand').click();

    await expect(page).toHaveURL(/\/alkoholtillstand$/);
    await expect(page.getByTestId('register-errand')).toBeEnabled();
  });
});
