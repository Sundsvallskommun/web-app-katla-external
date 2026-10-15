import { useEffect } from 'react';
import { useActiveWizardSteps } from 'src/hooks/use-active-wizard-steps';
import { useWizardStore } from 'src/stores/wizard-store';

import { WizardBottomBar } from './wizard-bottom-bar.component';
import { WizardHeader } from './wizard-header.component';
import { WizardStepContent } from './wizard-step-content.component';

export const MobileWizard: React.FC = () => {
  const steps = useActiveWizardSteps();
  const currentStep = useWizardStore((s) => s.currentStep);
  const goToStep = useWizardStore((s) => s.goToStep);
  const lastStep = steps.length - 1;

  // The step list can be shorter than the currentStep left in sessionStorage, for instance when
  // the other-parties flag is off. Without clamping, the saved step points past the end and the
  // wizard renders an empty step.
  useEffect(() => {
    if (currentStep > lastStep) {
      goToStep(lastStep);
    }
  }, [currentStep, goToStep, lastStep]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <WizardHeader />
      <main id="content" tabIndex={-1} className="flex-1 overflow-y-auto min-h-0">
        <WizardStepContent />
      </main>
      <WizardBottomBar />
    </div>
  );
};
