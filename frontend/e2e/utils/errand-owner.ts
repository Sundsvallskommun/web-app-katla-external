import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { mockOrganization } from '../fixtures/getMyOrganizations';
import { ownerStakeholderFor } from '../fixtures/getOwnerStakeholder';
import { mockSelfStakeholder } from '../fixtures/mockStakeholder';
import { jsonRoute } from './routes';
import { disclosureByTitle } from './stakeholder';

export const errandOwnerSection = (page: Page): Locator => disclosureByTitle(page, 'Kontaktuppgifter');

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
  await page.route('**/citizen/me', jsonRoute(mockSelfStakeholder));

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
