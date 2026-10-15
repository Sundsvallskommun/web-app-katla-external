import type { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { mockManualEditStakeholder, mockSelfStakeholder, mockStakeholder } from '../fixtures/mockStakeholder';
import {
  MOCK_COUNTRY_CODE_PHONE_NUMBER,
  MOCK_EMAIL,
  MOCK_INVALID_DATE_PERSON_NUMBER,
  MOCK_NON_EXISTENT_PERSON_NUMBER,
  MOCK_PERSON_NUMBER,
  MOCK_PHONE_NUMBER,
} from './constants';
import { emptyRoute, jsonRoute } from './routes';

/** Finds the disclosure section with the given title. */
export const disclosureByTitle = (page: Page, title: string): Locator =>
  page.locator('.sk-disclosure').filter({ has: page.locator('.sk-disclosure-header-title', { hasText: title }) });

/**
 * Buttons in the search and form sections are covered by a transparent
 * .sk-form-control-wrapper that captures pointer events, so an ordinary Playwright click does
 * not reach them. A synthetic click event does.
 */
const syntheticClick = (locator: Locator) => locator.dispatchEvent('click');

export const addStakeholder = async (page: Page, scope: Locator, role: string) => {
  await page.route(`**/citizen/person/${MOCK_PERSON_NUMBER}`, jsonRoute({ ...mockStakeholder, role }));
  await page.route(`**/citizen/person/${MOCK_NON_EXISTENT_PERSON_NUMBER}`, emptyRoute(204));

  const personNumberInput = scope.getByTestId('person-number-input');
  const searchButton = scope.locator('button', { hasText: 'Sök' });

  // Person number
  await personNumberInput.fill('PERSONNUMBER');
  await syntheticClick(searchButton);
  await expect(scope.getByTestId('person-number-error')).toBeVisible();
  await personNumberInput.fill(MOCK_NON_EXISTENT_PERSON_NUMBER);
  const emptyPersonResponse = page.waitForResponse(`**/citizen/person/${MOCK_NON_EXISTENT_PERSON_NUMBER}`);
  await syntheticClick(searchButton);
  await emptyPersonResponse;
  await expect(scope.getByTestId('empty-person-error')).toBeVisible();
  await syntheticClick(scope.locator('button[aria-label="Rensa"]'));
  await expect(scope.getByTestId('empty-person-error')).toHaveCount(0);
  await personNumberInput.fill(MOCK_INVALID_DATE_PERSON_NUMBER);
  await syntheticClick(searchButton);
  await expect(scope.getByTestId('person-number-error')).toBeVisible();
  await syntheticClick(scope.locator('button[aria-label="Rensa"]'));
  await expect(scope.getByTestId('person-number-error')).toHaveCount(0);
  await personNumberInput.fill(MOCK_PERSON_NUMBER);
  const personResponse = page.waitForResponse(`**/citizen/person/${MOCK_PERSON_NUMBER}`);
  await syntheticClick(searchButton);
  await personResponse;

  // Email
  await expect(scope.getByTestId('person-number-error')).toHaveCount(0);
  await expect(scope.getByTestId('email-input-error')).toHaveCount(0);
  await expect(scope.getByTestId('phone-number-input-error')).toHaveCount(0);
  const emailInput = scope.getByTestId('stakeholder-email-input');
  await emailInput.fill('EMAIL');
  await syntheticClick(scope.locator('button', { hasText: 'Lägg till person' }));
  await expect(scope.getByTestId('email-input-error')).toBeVisible();
  await emailInput.fill(MOCK_EMAIL);

  // Phone
  const phoneInput = scope.getByTestId('stakeholder-mobilephone-input');
  await phoneInput.fill('PHONENUMBER');
  await expect(scope.getByTestId('phone-number-input-error')).toBeVisible();
  await phoneInput.fill(MOCK_PHONE_NUMBER);
  await syntheticClick(scope.locator('button', { hasText: 'Lägg till person' }));
};

/** Adds the logged in citizen in one click; contact details are edited on the card afterwards. */
export const addSelfAsStakeholder = async (page: Page, scope: Locator) => {
  await page.route('**/citizen/me', jsonRoute(mockSelfStakeholder));

  const selfResponse = page.waitForResponse('**/citizen/me');
  await scope.getByTestId('add-self-button').dispatchEvent('click');
  await selfResponse;

  await expect(scope.getByTestId('search-result')).toHaveCount(0);
  await expect(scope.getByTestId('add-self-button')).toHaveCount(0);
};

export const manuallyAddStakeholder = async (page: Page) => {
  const modal = page.getByTestId('manual-person-modal');
  await expect(modal).toBeVisible();

  // No errors initially.
  await expect(modal.getByTestId('firstName-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('lastName-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('modal-email-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('modal-phone-input-error')).toHaveCount(0);

  // Errors appear after the first save attempt.
  await modal.getByTestId('modal-add-person-button').click();
  await expect(modal.getByTestId('firstName-input-error')).toBeVisible();
  await expect(modal.getByTestId('lastName-input-error')).toBeVisible();
  await expect(modal.getByTestId('modal-email-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('modal-phone-input-error')).toHaveCount(0);

  // A person number cannot be entered when adding manually.
  await expect(modal.getByTestId('modal-personNumber-input')).toHaveCount(0);

  // Name
  await modal.getByTestId('modal-firstName-input').fill('Test');
  await modal.getByTestId('modal-lastName-input').fill('Testsson');
  await expect(modal.getByTestId('firstName-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('lastName-input-error')).toHaveCount(0);

  // Email
  await modal.getByTestId('modal-email-input').fill('test');
  await modal.getByTestId('modal-add-person-button').click();
  await expect(modal.getByTestId('modal-email-input-error')).toBeVisible();
  await modal.getByTestId('modal-email-input').fill(MOCK_EMAIL);
  await expect(modal.getByTestId('modal-email-input-error')).toHaveCount(0);

  // Phone
  await modal.getByTestId('modal-phone-input').fill('Testsson');
  await modal.getByTestId('modal-add-person-button').click();
  await expect(modal.getByTestId('modal-phone-input-error')).toBeVisible();
  await modal.getByTestId('modal-phone-input').fill(MOCK_PHONE_NUMBER);
  await expect(modal.getByTestId('modal-phone-input-error')).toHaveCount(0);

  // There are no address fields when adding manually.
  await expect(modal.getByTestId('modal-address-input')).toHaveCount(0);
};

export const manuallyEditStakeholder = async (page: Page, stakeholder: StakeholderDTO) => {
  const modal = page.getByTestId('manual-person-modal');
  await expect(modal).toBeVisible();

  // No errors initially.
  await expect(modal.getByTestId('firstName-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('lastName-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('modal-email-input-error')).toHaveCount(0);
  await expect(modal.getByTestId('modal-phone-input-error')).toHaveCount(0);

  // The person number is not shown in the edit modal.
  await expect(modal.getByTestId('modal-personNumber-input')).toHaveCount(0);

  // Name
  const firstNameInput = modal.getByTestId('modal-firstName-input');
  await expect(firstNameInput).toHaveValue(stakeholder.firstName ?? '');
  await firstNameInput.fill('');
  await modal.getByTestId('modal-add-person-button').click();
  await expect(modal.getByTestId('firstName-input-error')).toBeVisible();
  await firstNameInput.fill(mockManualEditStakeholder.firstName ?? '');
  await expect(modal.getByTestId('firstName-input-error')).toHaveCount(0);
  const lastNameInput = modal.getByTestId('modal-lastName-input');
  await expect(lastNameInput).toHaveValue(stakeholder.lastName ?? '');
  await lastNameInput.fill('');
  await modal.getByTestId('modal-add-person-button').click();
  await expect(modal.getByTestId('lastName-input-error')).toBeVisible();
  await lastNameInput.fill(mockManualEditStakeholder.lastName ?? '');
  await expect(modal.getByTestId('lastName-input-error')).toHaveCount(0);

  // Email
  const emailInput = modal.getByTestId('modal-email-input');
  await expect(emailInput).toHaveValue(MOCK_EMAIL);
  await emailInput.fill('test');
  await modal.getByTestId('modal-add-person-button').click();
  await expect(modal.getByTestId('modal-email-input-error')).toBeVisible();
  await emailInput.fill(MOCK_EMAIL);
  await expect(modal.getByTestId('modal-email-input-error')).toHaveCount(0);
  await emailInput.fill('');

  // Phone
  const phoneInput = modal.getByTestId('modal-phone-input');
  await expect(phoneInput).toHaveValue(MOCK_COUNTRY_CODE_PHONE_NUMBER);
  await phoneInput.fill('Testsson');
  await modal.getByTestId('modal-add-person-button').click();
  await expect(modal.getByTestId('modal-phone-input-error')).toBeVisible();
  await phoneInput.fill(MOCK_PHONE_NUMBER);
  await expect(modal.getByTestId('modal-phone-input-error')).toHaveCount(0);

  // Address
  const addressInput = modal.getByTestId('modal-address-input');
  await expect(addressInput).toHaveValue(stakeholder.address ?? '');
  await addressInput.fill(mockManualEditStakeholder.address ?? '');
  const careOfInput = modal.getByTestId('modal-careOf-input');
  await expect(careOfInput).toHaveValue(stakeholder.careOf ?? '');
  await careOfInput.fill(mockManualEditStakeholder.careOf ?? '');
  const zipCodeInput = modal.getByTestId('modal-zipCode-input');
  await expect(zipCodeInput).toHaveValue(stakeholder.zipCode ?? '');
  await zipCodeInput.fill(mockManualEditStakeholder.zipCode ?? '');
  const cityInput = modal.getByTestId('modal-city-input');
  await expect(cityInput).toHaveValue(stakeholder.city ?? '');
  await cityInput.fill(mockManualEditStakeholder.city ?? '');
};
