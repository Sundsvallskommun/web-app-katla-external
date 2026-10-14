import type { LabelDTO } from '@data-contracts/backend/data-contracts';
import type { Page } from '@playwright/test';

import { mockOrganization, mockSecondOrganization } from '../fixtures/getMyOrganizations';
import { ownerStakeholderFor } from '../fixtures/getOwnerStakeholder';
import { mockErrand } from '../fixtures/mockErrand';
import {
  mockCategoryAlkohol,
  mockMetadata,
  mockSubTypeStadigvarande,
  mockTypeFolkol,
  mockTypeServering,
} from '../fixtures/mockMetadata';
import { mockManualEditStakeholder, mockSelfStakeholder, mockStakeholder } from '../fixtures/mockStakeholder';
import { aboutErrandSection, selectCategorization } from '../utils/categorization';
import { MOCK_COUNTRY_CODE_PHONE_NUMBER, MOCK_EMAIL, MOCK_HYPHEN_PERSON_NUMBER } from '../utils/constants';
import { addSelfAsErrandOwner, errandOwnerSection, selectErrandOwner } from '../utils/errand-owner';
import { emptyRoute, jsonRoute } from '../utils/routes';
import {
  addSelfAsStakeholder,
  addStakeholder,
  disclosureByTitle,
  manuallyAddStakeholder,
  manuallyEditStakeholder,
} from '../utils/stakeholder';
import { expect, test } from '../utils/test';

const OWNER_REQUIRED_MESSAGE =
  'Välj vilket företag eller vilken organisation ärendet gäller, eller lägg till dig själv som privatperson.';
const CATEGORY_REQUIRED_MESSAGE = 'Välj vilken kategori ärendet gäller.';

/** A metadata label as the errand stores it, without the subtree. */
const asErrandLabel = ({ classification, displayName, id, resourceName, resourcePath }: LabelDTO) => ({
  classification,
  displayName,
  id,
  resourceName,
  resourcePath,
});

interface CreateErrandRequestBody {
  jsonParameters?: { key: string; value: unknown; schemaId: string }[];
  labels?: Record<string, unknown>[];
  lifecycle?: string;
  parameters?: { key: string; values: string[] }[];
  stakeholders?: Record<string, unknown>[];
}

/**
 * Opens the confirmation dialog and returns the submit button. Shared by successful and failed
 * registrations so both paths go through the same checks.
 */
const openRegistrationConfirmation = async (page: Page) => {
  const registerButton = page.getByTestId('register-errand');
  await expect(registerButton).toBeEnabled();
  await registerButton.click();
  await expect(page.getByTestId('submit-logout-button')).toBeEnabled();
  const submitButton = page.getByTestId('submit-button');
  await expect(submitButton).toBeEnabled();
  return submitButton;
};

// The owner counts as a stakeholder: it is the errand's PRIMARY one.
const registerErrand = async (page: Page, expectedStakeholderCount: number) => {
  const submitButton = await openRegistrationConfirmation(page);
  const createRequest = page.waitForRequest(
    (request) => request.url().includes('/supportmanagement/errand/create') && request.method() === 'POST'
  );
  await submitButton.click();
  const request = await createRequest;
  const response = await request.response();
  expect(response?.status()).toBe(200);
  const body = request.postDataJSON() as CreateErrandRequestBody;
  // The form has no fields until the AoT schemas exist, so the errand should go out with no
  // parameters and no schema answers — only the stakeholders carry information so far.
  expect(body.parameters ?? []).toEqual([]);
  expect(body.jsonParameters).toEqual([]);
  expect(body.stakeholders?.length).toBe(expectedStakeholderCount);
  expect(body.lifecycle).toBe('ACTIVE');
  expect(body.labels).toEqual([mockCategoryAlkohol, mockTypeServering, mockSubTypeStadigvarande].map(asErrandLabel));
  return body;
};

test.describe('Register new errand page', () => {
  test.beforeEach(async ({ appUrl, page }) => {
    await page.route('**/supportmanagement/errand/create', jsonRoute(mockErrand));
    await page.route('**/supportmanagement/metadata', jsonRoute(mockMetadata));
    // 404 is the errand type having no form yet, not a failure.
    await page.route('**/schemas/**', emptyRoute(404));
    await page.goto(appUrl('/alkoholtillstand'));

    // Visible sections do not prove the server-rendered page has hydrated.
    // The client enables the register button, so it is the flow's readiness boundary.
    await expect(page.getByTestId('register-errand')).toBeEnabled();
  });

  test('Offers the categories the metadata allows, and keeps the type behind that choice', async ({ page }) => {
    const section = aboutErrandSection(page);

    // "Utgången kategori" is deprecated in the metadata and must not be offered.
    await expect(section.getByTestId('errand-category-select').locator('option')).toHaveText([
      'Välj kategori…',
      'Alkohol',
      'Tobak och nikotin',
    ]);
    await expect(section.getByTestId('errand-type-input')).toBeDisabled();

    await section.getByTestId('errand-category-select').selectOption(mockCategoryAlkohol.id ?? '');
    await expect(section.getByTestId('errand-type-input')).toBeEnabled();
    await section.getByTestId('errand-type-input').click();

    // Group headings and options both render as labels, leaf options before the groups.
    await expect(section.getByTestId('errand-type-list').locator('label')).toHaveText([
      'Folköl klass 2',
      'Serveringstillstånd',
      'Stadigvarande servering',
      'Tillfällig servering',
    ]);
  });

  test('Files a type without subtypes as two labels', async ({ page }) => {
    await selectCategorization(page, mockCategoryAlkohol, mockTypeFolkol);
    await selectErrandOwner(page);

    const submitButton = await openRegistrationConfirmation(page);
    const createRequest = page.waitForRequest(
      (request) => request.url().includes('/supportmanagement/errand/create') && request.method() === 'POST'
    );
    await submitButton.click();
    const body = (await createRequest).postDataJSON() as CreateErrandRequestBody;

    expect(body.labels).toEqual([mockCategoryAlkohol, mockTypeFolkol].map(asErrandLabel));
  });

  test('Shows the section scaffolding while the AoT fields are not built yet', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();

    for (const title of ['Vad vill du ansöka/anmäla om?', 'Kontaktuppgifter', 'Övriga parter']) {
      await expect(disclosureByTitle(page, title)).toBeVisible();
    }

    // These sections belong to the app this one was cloned from and must not remain.
    await expect(disclosureByTitle(page, 'Brukare')).toHaveCount(0);
    await expect(disclosureByTitle(page, 'Rapportör')).toHaveCount(0);

    await expect(page.getByRole('heading', { name: '2. Ärendeuppgifter' })).toBeVisible();
  });

  test('Lists the organizations the citizen has engagements in as errand owner', async ({ page }) => {
    const select = errandOwnerSection(page).getByTestId('errand-owner-select');

    // The placeholder option, so nothing is chosen while there is a choice to make.
    await expect(select).toHaveValue('');
    await expect(select.locator('option')).toHaveText([
      'Välj företag eller organisation',
      mockOrganization.organizationName,
      mockSecondOrganization.organizationName,
    ]);

    // Nothing is chosen yet, so there is no owner card.
    await expect(errandOwnerSection(page).getByTestId('stakeholder-card')).toHaveCount(0);
  });

  test('Shows the chosen organization as a card, and swaps it rather than adding a second', async ({ page }) => {
    const owner = errandOwnerSection(page);

    await selectErrandOwner(page, mockOrganization);
    await expect(owner.getByTestId('stakeholder-role')).toHaveText('Ärendeägare');
    await expect(owner.getByTestId('stakeholder-organizationNumber')).toHaveText(
      ownerStakeholderFor(mockOrganization).organizationNumber ?? ''
    );

    await selectErrandOwner(page, mockSecondOrganization);
    await expect(owner.getByTestId('stakeholder-card')).toHaveCount(1);
    await expect(owner.getByTestId('stakeholder-organizationNumber')).toHaveText(
      ownerStakeholderFor(mockSecondOrganization).organizationNumber ?? ''
    );
  });

  test('Clearing the choice removes the owner card', async ({ page }) => {
    const owner = errandOwnerSection(page);
    await selectErrandOwner(page, mockOrganization);

    await owner.getByTestId('errand-owner-select').selectOption('');

    await expect(owner.getByTestId('stakeholder-card')).toHaveCount(0);
  });

  test('Removes the owner from the card action', async ({ page }) => {
    const owner = errandOwnerSection(page);
    await selectErrandOwner(page, mockOrganization);

    await owner.getByTestId('remove-owner-button').click();

    await expect(owner.getByTestId('stakeholder-card')).toHaveCount(0);
    await expect(owner.getByTestId('errand-owner-select')).toHaveValue('');
  });

  test('Edits the owner contact details and files them with the errand', async ({ page }) => {
    const owner = errandOwnerSection(page);
    await selectCategorization(page);
    await selectErrandOwner(page, mockOrganization);

    await owner.getByTestId('edit-owner-button').click();
    await expect(page.getByTestId('errand-owner-modal')).toBeVisible();

    // Identity comes from the citizen's engagement and is not theirs to change.
    await expect(page.getByTestId('owner-organizationNumber')).toHaveValue(
      ownerStakeholderFor(mockOrganization).organizationNumber ?? ''
    );
    await expect(page.getByTestId('owner-organizationNumber')).toHaveAttribute('readonly', '');

    await page.getByTestId('owner-serveringsstalle-input').fill('Acme Krogen');
    await page.getByTestId('owner-address-input').fill('Storgatan 1');
    await page.getByTestId('owner-zipCode-input').fill('852 31');
    await page.getByTestId('owner-city-input').fill('Sundsvall');

    // Validated on add, so a bad address never reaches the errand.
    await page.getByTestId('owner-email-input').fill('inte-en-adress');
    await page.getByTestId('owner-email-add').click();
    await expect(page.getByTestId('owner-email-error')).toBeVisible();
    await expect(page.getByTestId('owner-email-value')).toHaveCount(0);

    await page.getByTestId('owner-email-input').fill('post@acme.se');
    await page.getByTestId('owner-email-add').click();
    await expect(page.getByTestId('owner-email-value')).toHaveText('post@acme.se');
    await page.getByTestId('owner-modal-save').click();

    await expect(owner.getByTestId('stakeholder-serveringsstalle')).toContainText('Acme Krogen');
    await expect(owner.getByTestId('stakeholder-address')).toContainText('Storgatan 1 852 31 Sundsvall');
    await expect(owner.getByTestId('stakeholder-email')).toHaveText('post@acme.se');

    const submitButton = await openRegistrationConfirmation(page);
    const createRequest = page.waitForRequest(
      (request) => request.url().includes('/supportmanagement/errand/create') && request.method() === 'POST'
    );
    await submitButton.click();
    const body = (await createRequest).postDataJSON() as CreateErrandRequestBody;

    expect(body.stakeholders?.[0]).toMatchObject({
      role: 'PRIMARY',
      externalId: mockOrganization.partyId,
      serveringsstalle: 'Acme Krogen',
      address: 'Storgatan 1',
      emails: ['post@acme.se'],
    });
  });

  test('Discards owner edits that were cancelled', async ({ page }) => {
    const owner = errandOwnerSection(page);
    await selectErrandOwner(page, mockOrganization);

    await owner.getByTestId('edit-owner-button').click();
    await page.getByTestId('owner-serveringsstalle-input').fill('Ska inte sparas');
    await page.getByTestId('owner-modal-cancel').click();

    await expect(owner.getByTestId('stakeholder-serveringsstalle')).toHaveCount(0);

    // Reopening shows what was filed, not the abandoned edit.
    await owner.getByTestId('edit-owner-button').click();
    await expect(page.getByTestId('owner-serveringsstalle-input')).toHaveValue('');
  });

  test('Refuses to register an errand before it has been categorized', async ({ page }) => {
    await page.getByTestId('register-errand').click();

    await expect(page.getByTestId('errand-category-error')).toContainText(CATEGORY_REQUIRED_MESSAGE);
    await expect(page.locator('#react-toast').getByText(CATEGORY_REQUIRED_MESSAGE)).toBeVisible();
    await expect(page.getByTestId('submit-button')).toHaveCount(0);
  });

  test('Refuses to register an errand before an owner has been chosen', async ({ page }) => {
    await selectCategorization(page);
    await page.getByTestId('register-errand').click();

    // The message is deliberately in two places: the toast reports the failed attempt, the
    // inline error marks the field to fix. Assert each rather than an unscoped text match.
    await expect(page.getByTestId('errand-owner-error')).toContainText(OWNER_REQUIRED_MESSAGE);
    await expect(page.locator('#react-toast').getByText(OWNER_REQUIRED_MESSAGE)).toBeVisible();
    await expect(page.getByTestId('submit-button')).toHaveCount(0);
  });

  test('Registers an errand without any form fields filled in', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();

    await selectCategorization(page);
    await selectErrandOwner(page);

    await registerErrand(page, 1);
  });

  test('Files the chosen organization as the errand owner', async ({ page }) => {
    await selectCategorization(page);
    await selectErrandOwner(page, mockSecondOrganization);

    const submitButton = await openRegistrationConfirmation(page);
    const createRequest = page.waitForRequest(
      (request) => request.url().includes('/supportmanagement/errand/create') && request.method() === 'POST'
    );
    await submitButton.click();
    const body = (await createRequest).postDataJSON() as CreateErrandRequestBody;

    expect(body.stakeholders).toEqual([ownerStakeholderFor(mockSecondOrganization)]);
  });

  test('Files the logged in citizen as a private errand owner', async ({ page }) => {
    const owner = errandOwnerSection(page);
    await selectCategorization(page);
    await addSelfAsErrandOwner(page);

    await expect(owner.getByTestId('stakeholder-role')).toHaveText('Ärendeägare');
    await expect(owner.getByTestId('stakeholder-personNumber')).toHaveText(MOCK_HYPHEN_PERSON_NUMBER);
    await expect(owner.getByTestId('stakeholder-address')).toContainText('Storgatan 1 85230 Sundsvall');

    // Identity comes from the login and is not theirs to change; the serving location is.
    await owner.getByTestId('edit-owner-button').click();
    await expect(page.getByTestId('owner-personNumber')).toHaveValue(MOCK_HYPHEN_PERSON_NUMBER);
    await expect(page.getByTestId('owner-personNumber')).toHaveAttribute('readonly', '');
    await page.getByTestId('owner-serveringsstalle-input').fill('Festlokalen');
    await page.getByTestId('owner-modal-save').click();
    await expect(owner.getByTestId('stakeholder-serveringsstalle')).toContainText('Festlokalen');

    const submitButton = await openRegistrationConfirmation(page);
    const createRequest = page.waitForRequest(
      (request) => request.url().includes('/supportmanagement/errand/create') && request.method() === 'POST'
    );
    await submitButton.click();
    const body = (await createRequest).postDataJSON() as CreateErrandRequestBody;

    expect(body.stakeholders).toEqual([
      expect.objectContaining({
        role: 'PRIMARY',
        externalIdType: 'PRIVATE',
        externalId: mockSelfStakeholder.externalId,
        firstName: mockSelfStakeholder.firstName,
        serveringsstalle: 'Festlokalen',
      }),
    ]);
  });

  test('Removing the private owner offers the organizations and the citizen again', async ({ page }) => {
    const owner = errandOwnerSection(page);
    await addSelfAsErrandOwner(page);

    await owner.getByTestId('remove-owner-button').click();

    await expect(owner.getByTestId('stakeholder-card')).toHaveCount(0);
    await expect(owner.getByTestId('errand-owner-select')).toHaveValue('');
    await expect(owner.getByTestId('add-self-owner-button')).toBeVisible();
  });

  test('Adds a stakeholder using personnumber and registers the errand', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();

    const ovrigaParter = disclosureByTitle(page, 'Övriga parter');
    await addStakeholder(page, ovrigaParter, 'CONTACT');
    await expect(ovrigaParter.getByTestId('edit-card-button').first()).toBeVisible();
    await expect(ovrigaParter.getByTestId('remove-card-button').first()).toBeVisible();
    await expect(ovrigaParter.getByTestId('add-manual-person-button')).toBeVisible();

    await selectCategorization(page);
    await selectErrandOwner(page);
    const body = await registerErrand(page, 2);

    expect(body.stakeholders).toContainEqual(
      expect.objectContaining({ role: 'CONTACT', externalIdType: 'PRIVATE', externalId: mockStakeholder.externalId })
    );
  });

  test('Adds the logged in citizen as a stakeholder and registers the errand', async ({ page }) => {
    const ovrigaParter = disclosureByTitle(page, 'Övriga parter');
    await addSelfAsStakeholder(page, ovrigaParter);

    const card = ovrigaParter.getByTestId('stakeholder-card');
    await expect(card).toHaveCount(1);
    await expect(card.getByTestId('stakeholder-role')).toHaveText('Kontaktperson');
    await expect(card.getByTestId('stakeholder-name')).toContainText('Förnamn Efternamn');
    await expect(card.getByTestId('stakeholder-personNumber')).toContainText(MOCK_HYPHEN_PERSON_NUMBER);
    await expect(card.getByTestId('stakeholder-email')).toHaveText('E-postadress saknas');
    await expect(card.getByTestId('edit-card-button')).toBeVisible();
    await expect(ovrigaParter.getByTestId('add-manual-person-button')).toBeVisible();

    await selectCategorization(page);
    await selectErrandOwner(page);
    const body = await registerErrand(page, 2);

    expect(body.stakeholders).toContainEqual(
      expect.objectContaining({
        role: 'CONTACT',
        externalIdType: 'PRIVATE',
        externalId: mockSelfStakeholder.externalId,
        firstName: 'Förnamn',
        lastName: 'Efternamn',
        personNumber: MOCK_HYPHEN_PERSON_NUMBER,
      })
    );
  });

  test('Preserves entered data and stays on the form when registration fails', async ({ page }) => {
    await page.route('**/supportmanagement/errand/create', jsonRoute({ message: 'Upstream unavailable' }, 502));

    const ovrigaParter = disclosureByTitle(page, 'Övriga parter');
    await addStakeholder(page, ovrigaParter, 'CONTACT');
    await expect(ovrigaParter.getByTestId('stakeholder-card')).toHaveCount(1);
    await selectCategorization(page);
    await selectErrandOwner(page);

    const submitButton = await openRegistrationConfirmation(page);
    const failedResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/supportmanagement/errand/create') && response.request().method() === 'POST'
    );
    await submitButton.click();
    const response = await failedResponse;
    expect(response.status()).toBe(502);

    await expect(page).toHaveURL(/\/alkoholtillstand$/);
    await expect(ovrigaParter.getByTestId('stakeholder-card')).toHaveCount(1);
    await expect(page.getByText('Något gick fel när ärendet sparades')).toBeVisible();
    await expect(page.getByText('Ärendet skickades in')).toHaveCount(0);
  });

  test('Manually adds a stakeholder and registers the errand', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();

    const ovrigaParter = disclosureByTitle(page, 'Övriga parter');
    await ovrigaParter.getByTestId('add-manual-person-button').dispatchEvent('click');

    await manuallyAddStakeholder(page);
    await page.getByTestId('modal-cancel-person-button').click();
    await expect(page.getByTestId('manual-person-modal')).toHaveCount(0);
    await expect(ovrigaParter.getByTestId('stakeholder-card')).toHaveCount(0);

    await ovrigaParter.getByTestId('add-manual-person-button').dispatchEvent('click');
    await manuallyAddStakeholder(page);
    await page.getByTestId('modal-add-person-button').click();
    await expect(page.getByTestId('manual-person-modal')).toHaveCount(0);

    await expect(ovrigaParter.getByTestId('edit-card-button')).toBeVisible();
    await expect(ovrigaParter.getByTestId('remove-card-button')).toBeVisible();
    await expect(ovrigaParter.getByTestId('add-manual-person-button')).toBeVisible();

    await selectCategorization(page);
    await selectErrandOwner(page);
    const body = await registerErrand(page, 2);

    expect(body.stakeholders).toContainEqual(
      expect.objectContaining({ role: 'CONTACT', externalIdType: 'PRIVATE', firstName: 'Test', lastName: 'Testsson' })
    );
  });

  test('Manually edits and removes a stakeholder', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();

    const ovrigaParter = disclosureByTitle(page, 'Övriga parter');
    await addStakeholder(page, ovrigaParter, 'CONTACT');
    await expect(ovrigaParter.getByTestId('edit-card-button')).toBeVisible();
    await ovrigaParter.getByTestId('remove-card-button').dispatchEvent('click');
    await expect(ovrigaParter.getByTestId('stakeholder-card')).toHaveCount(0);

    await addStakeholder(page, ovrigaParter, 'CONTACT');
    await ovrigaParter.getByTestId('edit-card-button').dispatchEvent('click');

    await manuallyEditStakeholder(page, mockStakeholder);
    await page.getByTestId('modal-cancel-person-button').click();
    await expect(page.getByTestId('manual-person-modal')).toHaveCount(0);

    const stakeholderCard = ovrigaParter.getByTestId('stakeholder-card');
    await expect(stakeholderCard.getByTestId('stakeholder-name')).toContainText(
      `${mockStakeholder.firstName ?? ''} ${mockStakeholder.lastName ?? ''}`
    );
    await expect(stakeholderCard.getByTestId('stakeholder-personNumber')).toContainText(MOCK_HYPHEN_PERSON_NUMBER);
    await expect(stakeholderCard.getByTestId('stakeholder-email')).toContainText(MOCK_EMAIL);
    await expect(stakeholderCard.getByTestId('stakeholder-phonenumber')).toContainText(MOCK_COUNTRY_CODE_PHONE_NUMBER);

    await ovrigaParter.getByTestId('edit-card-button').dispatchEvent('click');
    await manuallyEditStakeholder(page, mockStakeholder);
    await page.getByTestId('modal-add-person-button').click();
    await expect(page.getByTestId('manual-person-modal')).toHaveCount(0);

    await expect(stakeholderCard.getByTestId('stakeholder-name')).toContainText(
      `${mockManualEditStakeholder.firstName ?? ''} ${mockManualEditStakeholder.lastName ?? ''}`
    );
    await expect(stakeholderCard.getByTestId('stakeholder-address')).toContainText(
      `${mockManualEditStakeholder.address ?? ''} ${mockManualEditStakeholder.city ?? ''}`
    );

    await selectCategorization(page);
    await selectErrandOwner(page);
    await registerErrand(page, 2);
  });
});
