import { mockCountDraftErrands, mockCountNewErrands, mockCountSolvedErrands } from '../fixtures/mockCount';
import { mockErrands } from '../fixtures/mockErrands';
import { mockMetadata } from '../fixtures/mockMetadata';
import { jsonRoute } from '../utils/routes';
import { OVERVIEW_PATH, SERVICE_PATH } from '../utils/service';
import { expect, test } from '../utils/test';

test.describe('Overview page', () => {
  test.beforeEach(async ({ appUrl, page }) => {
    await page.route(
      (url) => url.pathname.endsWith('/supportmanagement/errands') && url.searchParams.get('page') === '0',
      jsonRoute(mockErrands)
    );
    await page.route(
      (url) => url.pathname.endsWith('/supportmanagement/count') && url.searchParams.get('status') === 'NEW',
      jsonRoute(mockCountNewErrands)
    );
    await page.route(
      (url) => url.pathname.endsWith('/supportmanagement/count') && url.searchParams.get('lifecycle') === 'DRAFT',
      jsonRoute(mockCountDraftErrands)
    );
    await page.route(
      (url) => url.pathname.endsWith('/supportmanagement/count') && url.searchParams.get('status') === 'SOLVED',
      jsonRoute(mockCountSolvedErrands)
    );
    await page.route('**/supportmanagement/metadata', jsonRoute(mockMetadata));
    await page.goto(appUrl(OVERVIEW_PATH));
  });

  test('Show sidebar filter buttons with errand count', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
    const openErrandsButton = page.locator('[aria-label="status-button-öppna ärenden"]');
    await expect(openErrandsButton).toBeEnabled();
    await expect(openErrandsButton).toContainText(`Öppna ärenden${mockCountNewErrands.count}`);
    const solvedErrandsButton = page.locator('[aria-label="status-button-avslutade ärenden"]');
    await expect(solvedErrandsButton).toBeEnabled();
    await expect(solvedErrandsButton).toContainText(`Avslutade ärenden${mockCountSolvedErrands.count}`);
    const logoutButton = page.getByTestId('logout-button');
    await expect(logoutButton).toBeEnabled();
    await expect(logoutButton).toContainText('Logga ut');
    await logoutButton.click();
  });

  test('Show correct errand table header and correct ammount of errands', async ({ page }) => {
    const table = page.getByTestId('errand-table');
    await expect(table).toBeVisible();

    const headerCells = table.locator('.sk-table-thead-tr').first().locator('th');
    await expect(headerCells.nth(0).locator('span').first()).toHaveText('Status');
    await expect(headerCells.nth(1).locator('span').first()).toHaveText('Ärendenummer');
    await expect(headerCells.nth(2).locator('span').first()).toHaveText('Ärendetyp');
    await expect(headerCells.nth(3).locator('span').first()).toHaveText('Rapporterat');

    const firstRowCells = table.locator('.sk-table-tbody-tr').first().locator('td');
    await expect(firstRowCells.nth(2)).toHaveText('Stadigvarande servering');

    await expect(table.locator('.sk-table-tbody-tr')).toHaveCount(mockErrands?.content?.length ?? 0);
  });

  test('Links to registration exactly once below the configured base path', async ({ baseURL, page }) => {
    const appBaseUrl = new URL(baseURL ?? 'http://localhost:3000');
    const basePath = appBaseUrl.pathname.replace(/\/$/, '');

    await expect(page.getByTestId('register-new-errand-button')).toHaveAttribute('href', `${basePath}${SERVICE_PATH}`);
  });

  // TODO: Add test for search field when frontend functionality is ready
  // TODO: Add test for all filters
});
