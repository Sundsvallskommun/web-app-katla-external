export interface WizardStep {
  id: string;
  titleKey: string;
}

export const ALL_WIZARD_STEPS: WizardStep[] = [
  { id: 'about', titleKey: 'errand-information:about.title' },
  { id: 'owner', titleKey: 'errand-information:owner.title' },
  { id: 'other-parties', titleKey: 'errand-information:other_parties.title' },
  { id: 'details', titleKey: 'errand-information:errand_details.title' },
  { id: 'attachments', titleKey: 'errand-information:attachments.title' },
  { id: 'summary', titleKey: 'errand-information:wizard.summary' },
];

/**
 * Other parties sits behind a feature flag and renders as its own section on desktop too, so
 * the step is dropped entirely when the flag is off rather than showing an empty step.
 */
export function getActiveWizardSteps(otherPartiesEnabled: boolean): WizardStep[] {
  if (otherPartiesEnabled) {
    return ALL_WIZARD_STEPS;
  }
  return ALL_WIZARD_STEPS.filter((step) => step.id !== 'other-parties');
}
