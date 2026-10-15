import type { Page } from '@playwright/test';

import { mockErrand } from '../fixtures/mockErrand';
import { mockMetadata } from '../fixtures/mockMetadata';
import { selectCategorization } from '../utils/categorization';
import { jsonRoute } from '../utils/routes';
import { SERVICE_PATH } from '../utils/service';
import { addStakeholder, disclosureByTitle } from '../utils/stakeholder';
import { expect, test } from '../utils/test';

/**
 * The language choice must be reachable from the header, without going through the user menu.
 * Names are written in the language itself, so the same selector works whatever language the
 * page is shown in.
 *
 * The header renders both the desktop and mobile rows and hides one with CSS. The filter picks
 * the one actually usable at the current width — the same choice a user makes.
 */
const switchLanguageTo = async (page: Page, language: string) => {
  await page.getByTestId('language-switch-button').filter({ visible: true }).click();
  await page.getByRole('menuitemradio', { name: language }).click();
};

test.describe('Language switching', () => {
  test.beforeEach(async ({ appUrl, page }) => {
    await page.route('**/supportmanagement/errand/create', jsonRoute(mockErrand));
    await page.route('**/supportmanagement/metadata', jsonRoute(mockMetadata));
    await page.goto(appUrl(SERVICE_PATH));
  });

  test('keeps the entered registration form when the language changes', async ({ page }) => {
    await expect(page.getByTestId('register-errand')).toBeEnabled();

    // Added parties are the only entered data the form holds until the AoT fields exist, so the
    // handover is measured on them.
    const ovrigaParter = disclosureByTitle(page, 'Övriga parter');
    await addStakeholder(page, ovrigaParter, 'CONTACT');
    await expect(ovrigaParter.getByTestId('stakeholder-card')).toHaveCount(1);

    await switchLanguageTo(page, 'English');

    await expect(page).toHaveURL(/\/en\/alkoholtillstand$/);

    // Switching language remounts the whole errand tree. Without the handover the user faces an
    // empty form, and changing language costs them a fresh start.
    await expect(disclosureByTitle(page, 'Other parties').getByTestId('stakeholder-card')).toHaveCount(1);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('changes language from the registration header without leaving the wizard', async ({ page }) => {
      // Step 1 is the categorization step, which the wizard will not leave uncategorized.
      await selectCategorization(page);
      await page.getByRole('button', { name: 'Nästa' }).click();
      // Only the position matters here; the total follows the wizard's step list.
      await expect(page.getByText(/^Steg 2\/\d+$/)).toBeVisible();

      await switchLanguageTo(page, 'English');

      await expect(page).toHaveURL(/\/en\/alkoholtillstand$/);

      // Still in the wizard, on the same step: switching language must not force the user out of
      // registration.
      await expect(page.getByText(/^Step 2\/\d+$/)).toBeVisible();
    });

    test('opens the language panel under the button and inside the viewport', async ({ page }) => {
      const button = page.getByTestId('language-switch-button').filter({ visible: true });
      await button.click();

      const panel = page.getByRole('menu').filter({ visible: true }).first();
      await expect(panel).toBeVisible();

      const buttonBox = await button.boundingBox();
      const panelBox = await panel.boundingBox();
      const viewport = page.viewportSize();
      if (!buttonBox || !panelBox || !viewport) throw new Error('Saknar mått för knapp, panel eller viewport');

      // The design system gives the panel only `right: 0`; its vertical placement comes from its
      // static position in normal flow. Inside a flex container with items-center the panel is
      // centred on the button instead and covers the header, partly off screen. Measuring is what
      // catches that regression.
      expect(panelBox.y).toBeGreaterThanOrEqual(buttonBox.y + buttonBox.height);
      expect(panelBox.x).toBeGreaterThanOrEqual(0);
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width);
    });
  });
});
