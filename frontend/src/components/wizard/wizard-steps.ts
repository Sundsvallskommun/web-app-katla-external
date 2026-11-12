import type { SchemaSection } from '@components/json/utils/schema-sections';
import type { TFunction } from 'i18next';

export type FixedWizardStepId = 'about' | 'owner' | 'other-parties' | 'details' | 'attachments' | 'summary';

export interface FixedWizardStep {
  kind: 'fixed';
  id: FixedWizardStepId;
  titleKey: string;
}

/** One `ui:sections` entry of the errand type's form. */
export interface SectionWizardStep {
  kind: 'section';
  id: string;
  section: SchemaSection;
}

export type WizardStep = FixedWizardStep | SectionWizardStep;

export const ALL_WIZARD_STEPS: FixedWizardStep[] = [
  { kind: 'fixed', id: 'about', titleKey: 'errand-information:about.title' },
  { kind: 'fixed', id: 'owner', titleKey: 'errand-information:owner.title' },
  { kind: 'fixed', id: 'other-parties', titleKey: 'errand-information:other_parties.title' },
  { kind: 'fixed', id: 'details', titleKey: 'errand-information:errand_details.title' },
  { kind: 'fixed', id: 'attachments', titleKey: 'errand-information:attachments.title' },
  { kind: 'fixed', id: 'summary', titleKey: 'errand-information:wizard.summary' },
];

export const sectionStepId = (section: SchemaSection): string => `section:${section.schemaName}:${section.id}`;

/** Where the form is filled in: the details step, or the section steps that replace it. */
export const isFormStep = (step: WizardStep): boolean => step.kind === 'section' || step.id === 'details';

/**
 * Other parties sits behind a feature flag, so the step is dropped entirely when the flag is off
 * rather than showing an empty step. The form's sections replace Ärendeuppgifter; without
 * sections (or before the errand type is known) the form is one step.
 */
export function getActiveWizardSteps(
  otherPartiesEnabled: boolean,
  sections: readonly SchemaSection[] = []
): WizardStep[] {
  return ALL_WIZARD_STEPS.flatMap((step): WizardStep[] => {
    if (step.id === 'other-parties' && !otherPartiesEnabled) return [];
    if (step.id === 'details' && sections.length > 0) {
      return sections.map((section) => ({ kind: 'section', id: sectionStepId(section), section }));
    }
    return [step];
  });
}

/**
 * Where to go when the remembered step is not in the list: a form step is replaced by the form's
 * first step when the errand type's sections changed, anything else by the start.
 */
export function fallbackStep(steps: WizardStep[], missingStepId: string): WizardStep {
  const wasFormStep = missingStepId === 'details' || missingStepId.startsWith('section:');
  return (wasFormStep ? steps.find(isFormStep) : undefined) ?? steps[0];
}

/** Section titles come from the jsonschema service, already in the requested language. */
export const wizardStepTitle = (step: WizardStep, t: TFunction): string =>
  step.kind === 'section' ? step.section.title : t(step.titleKey);
