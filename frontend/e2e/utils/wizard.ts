import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const STEP = {
  about: 'Vad vill du ansöka/anmäla om?',
  owner: 'Kontaktuppgifter',
  otherParties: 'Övriga parter',
  details: 'Ärendeuppgifter',
  attachments: 'Bilagor',
  summary: 'Sammanfattning',
} as const;

/** The content of the step currently shown. */
export const currentStep = (page: Page): Locator => page.locator('main#content');

export const stepTitle = (page: Page): Locator => page.getByTestId('wizard-step-title');

/** Moves one step forward and expects the current step to let the user through. */
export const nextStep = async (page: Page) => {
  const title = (await stepTitle(page).textContent()) ?? '';
  await page.getByTestId('wizard-next').click();
  await expect(stepTitle(page)).not.toHaveText(title);
};

/** Moves forward until the step with the given title is shown. */
export const goToStep = async (page: Page, title: string) => {
  for (let guard = 0; (await stepTitle(page).textContent()) !== title; guard++) {
    if (guard > 10) throw new Error(`Steget ${title} nåddes aldrig`);
    await nextStep(page);
  }
};
