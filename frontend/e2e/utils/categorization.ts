import type { LabelDTO } from '@data-contracts/backend/data-contracts';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { mockCategoryAlkohol, mockSubTypeStadigvarande } from '../fixtures/mockMetadata';
import { disclosureByTitle } from './stakeholder';

export const aboutErrandSection = (page: Page): Locator => disclosureByTitle(page, 'Vad vill du ansöka/anmäla om?');

/** The option list stays mounted but hidden, so the combobox has to be opened before clicking. */
export const selectCategorization = async (
  page: Page,
  category: LabelDTO = mockCategoryAlkohol,
  leaf: LabelDTO = mockSubTypeStadigvarande
) => {
  // Page-scoped, not section-scoped: the mobile wizard renders these outside the disclosure.
  await page.getByTestId('errand-category-select').selectOption(category.id ?? '');
  await page.getByTestId('errand-type-input').click();
  await page
    .getByTestId('errand-type-list')
    .getByRole('option', { name: leaf.displayName ?? '' })
    .click();

  await expect(page.getByTestId('errand-type-input')).toHaveValue(leaf.displayName ?? '');
};
