import type { Locator, Page } from '@playwright/test';

import { mockErrand } from '../fixtures/mockErrand';
import { mockMetadata } from '../fixtures/mockMetadata';
import { mockReporterStakeholder } from '../fixtures/mockStakeholder';
import { MOCK_COUNTRY_CODE_PHONE_NUMBER } from '../utils/constants';
import { jsonRoute } from '../utils/routes';
import { errandPagePath } from '../utils/service';
import { expect, test } from '../utils/test';

const MOBILE_VIEWPORT = { width: 431, height: 932 };
const DESKTOP_VIEWPORT = { width: 1536, height: 960 };

// Long names, roles and email addresses are the normal case. An email address has no spaces
// and so sets the card's min-content width unless it is allowed to wrap. The party sits under
// Other parties, the only section showing cards so far.
const longContact = {
  ...mockReporterStakeholder,
  role: 'CONTACT',
  firstName: 'Ulrika',
  lastName: 'Wiklund',
  title: 'Specialistundersköterska',
  department: 'VOF HOS Korttidsboende 1',
  emails: ['ulrika.wiklund@example.com'],
  phoneNumbers: [MOCK_COUNTRY_CODE_PHONE_NUMBER],
};

const errandPath = errandPagePath(mockErrand.errandNumber);

// boundingBox() returns null for elements that are not visible. Without this check an
// unmeasurable element would quietly reduce the comparisons below to 0 <= 0 instead of failing.
const measure = async (locator: Locator, name: string) => {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`Kunde inte mäta ${name} — elementet är inte synligt`);
  }
  return { ...box, right: box.x + box.width };
};

/** mockErrand is a filed errand: status NEW and no draft lifecycle. */
const openErrand = async (page: Page, appUrl: (path: string) => string, lifecycle?: 'DRAFT' | 'ACTIVE') => {
  await page.route(
    `**/supportmanagement/errand/${mockErrand.errandNumber}`,
    jsonRoute({ ...mockErrand, stakeholders: [longContact], ...(lifecycle === undefined ? {} : { lifecycle }) })
  );
  await page.route('**/supportmanagement/metadata', jsonRoute(mockMetadata));
  await page.goto(appUrl(errandPath));
};

const openStakeholderCard = async (page: Page, appUrl: (path: string) => string) => {
  await openErrand(page, appUrl);

  const card = page.getByTestId('stakeholder-card').first();
  await expect(card).toBeVisible();
  return card;
};

test.describe('Errand basic information page', () => {
  test('Stakeholder card keeps long contact details inside its own bounds on mobile', async ({ appUrl, page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    const card = await openStakeholderCard(page, appUrl);

    const cardBox = await measure(card, 'stakeholder-card');
    const emailBox = await measure(card.getByTestId('stakeholder-email'), 'stakeholder-email');
    const departmentBox = await measure(card.getByTestId('stakeholder-department'), 'stakeholder-department');
    const cardOverflow = await card.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));

    expect(cardOverflow.scrollWidth).toBeLessThanOrEqual(cardOverflow.clientWidth);
    expect(emailBox.right).toBeLessThanOrEqual(cardBox.right);
    expect(departmentBox.right).toBeLessThanOrEqual(cardBox.right);
    // app-base.scss clips horizontal overflow on body, so the text is not scrolled into view —
    // it disappears past the screen edge. Visibility is therefore measured against the viewport
    // rather than documentElement.scrollWidth, which can never grow.
    expect(emailBox.right).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    expect(cardBox.right).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
  });

  test('Stakeholder card keeps its two columns side by side on desktop', async ({ appUrl, page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const card = await openStakeholderCard(page, appUrl);

    const departmentBox = await measure(card.getByTestId('stakeholder-department'), 'stakeholder-department');
    const emailBox = await measure(card.getByTestId('stakeholder-email'), 'stakeholder-email');
    const cardOverflow = await card.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));

    // The email column belongs to the right of the department column, not below it.
    expect(emailBox.x).toBeGreaterThanOrEqual(departmentBox.right);
    expect(cardOverflow.scrollWidth).toBeLessThanOrEqual(cardOverflow.clientWidth);
  });

  test('Submitted errand omits editing actions and says why', async ({ appUrl, page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    const card = await openStakeholderCard(page, appUrl);

    await expect(page.getByTestId('read-only-notice')).toBeVisible();
    // A dimmed but visible control reads as broken. Every editing surface must be absent, not
    // just the card's own buttons.
    await expect(card.getByTestId('edit-card-button')).toHaveCount(0);
    await expect(card.getByTestId('remove-card-button')).toHaveCount(0);
    await expect(page.getByTestId('person-number-input')).toHaveCount(0);
    await expect(page.getByTestId('add-manual-person-button')).toHaveCount(0);
  });

  test('Draft errand resumes in the wizard on mobile', async ({ appUrl, page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openErrand(page, appUrl, 'DRAFT');

    // The wizard's step indicator exists only in the wizard view, never in the tab view.
    await expect(page.getByText(/^Steg 1\/\d+$/)).toBeVisible();
    await expect(page.getByTestId('read-only-notice')).toHaveCount(0);
  });

  test('Draft errand still uses the tab layout on desktop', async ({ appUrl, page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openErrand(page, appUrl, 'DRAFT');

    await expect(page.getByTestId('stakeholder-card').first()).toBeVisible();
    await expect(page.getByText(/^Steg 1\/\d+$/)).toHaveCount(0);
    // Drafts are editable, so the actions stay here.
    await expect(page.getByTestId('edit-card-button').first()).toBeVisible();
    await expect(page.getByTestId('person-number-input').first()).toBeVisible();
  });
});
