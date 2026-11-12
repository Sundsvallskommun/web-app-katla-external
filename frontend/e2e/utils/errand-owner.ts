import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { mockOrganization } from '../fixtures/getMyOrganizations';
import { ownerStakeholderFor } from '../fixtures/getOwnerStakeholder';
import { mockSelfStakeholder } from '../fixtures/mockStakeholder';
import { selectCategorization } from './categorization';
import { currentStep, goToStep, nextStep, STEP, stepTitle } from './wizard';

export const errandOwnerSection = (page: Page): Locator => currentStep(page);

/** Picks the errand owner, which registration requires. */
export const selectErrandOwner = async (page: Page, organization = mockOrganization) => {
  const section = errandOwnerSection(page);
  await section.getByTestId('errand-owner-select').selectOption(organization.partyId);

  await expect(section.getByTestId('stakeholder-card')).toBeVisible();
  await expect(section.getByTestId('stakeholder-name')).toHaveText(organization.organizationName);
  await expect(section.getByTestId('stakeholder-address')).toContainText(
    ownerStakeholderFor(organization).address ?? ''
  );
};

/** Makes the logged in citizen the errand owner, as a private person. */
export const addSelfAsErrandOwner = async (page: Page) => {
  const section = errandOwnerSection(page);

  const selfResponse = page.waitForResponse('**/citizen/me');
  await section.getByTestId('add-self-owner-button').dispatchEvent('click');
  await selfResponse;

  await expect(section.getByTestId('stakeholder-card')).toBeVisible();
  await expect(section.getByTestId('stakeholder-name')).toHaveText(
    `${mockSelfStakeholder.firstName ?? ''} ${mockSelfStakeholder.lastName ?? ''}`
  );
  await expect(section.getByTestId('add-self-owner-button')).toHaveCount(0);
  await expect(section.getByTestId('errand-owner-select')).toHaveCount(0);
};

/** Categorizes the errand and moves on to the owner step. */
export const goToOwnerStep = async (page: Page) => {
  await selectCategorization(page);
  await nextStep(page);
  await expect(stepTitle(page)).toHaveText(STEP.owner);
};

/** Fills in what the first two steps require and moves on to the given step. */
export const passBasicSteps = async (page: Page, title: string, organization = mockOrganization) => {
  await goToOwnerStep(page);
  await selectErrandOwner(page, organization);
  await goToStep(page, title);
};
