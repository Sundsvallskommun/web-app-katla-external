import { createContext, useContext } from 'react';
import { useWizardStore } from 'src/stores/wizard-store';

import { WizardStep } from './wizard-steps';

export interface WizardStepsValue {
  steps: WizardStep[];
  /** Position of the current step in `steps`, resolved by the Wizard. */
  current: number;
}

/** One step list per wizard, so every part agrees on it while the form's sections load. */
export const WizardStepsContext = createContext<WizardStepsValue | null>(null);

export function useWizardSteps() {
  const value = useContext(WizardStepsContext);
  const goToStep = useWizardStore((s) => s.goToStep);
  if (!value) throw new Error('useWizardSteps must be used inside WizardStepsContext');

  const { steps, current } = value;
  const step = steps[current];

  return {
    steps,
    current,
    step,
    isFirst: current === 0,
    isLast: current === steps.length - 1,
    goToStep,
    goNext: () => {
      if (current < steps.length - 1) goToStep(steps[current + 1].id);
    },
    goBack: () => {
      if (current > 0) goToStep(steps[current - 1].id);
    },
  };
}
