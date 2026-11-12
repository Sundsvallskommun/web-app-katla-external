import { cx, Spinner } from '@sk-web-gui/react';
import { useEffect, useMemo } from 'react';
import { appConfig } from 'src/config/appconfig';
import { MOBILE_BREAKPOINT } from 'src/constants/responsive';
import { useErrandSchemaSections } from 'src/hooks/use-errand-schema-sections';
import { useMediaQuery } from 'src/hooks/use-media-query';
import { useWizardStore } from 'src/stores/wizard-store';

import { WizardBottomBar } from './wizard-bottom-bar.component';
import { WizardHeader } from './wizard-header.component';
import { WizardStepContent } from './wizard-step-content.component';
import { fallbackStep, getActiveWizardSteps } from './wizard-steps';
import { WizardStepsContext } from './wizard-steps-context';

interface WizardProps {
  title: string;
}

export const Wizard: React.FC<WizardProps> = ({ title }) => {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const otherPartiesEnabled = appConfig.features.otherPartiesDisclosure;
  const { sections, loading } = useErrandSchemaSections();
  const steps = useMemo(() => getActiveWizardSteps(otherPartiesEnabled, sections), [otherPartiesEnabled, sections]);
  const currentStepId = useWizardStore((s) => s.currentStepId);
  const goToStep = useWizardStore((s) => s.goToStep);
  const current = steps.findIndex((step) => step.id === currentStepId);

  // A remembered section step is unknown until the sections have loaded, so it is only replaced
  // once they have.
  useEffect(() => {
    if (current === -1 && !loading) goToStep(fallbackStep(steps, currentStepId).id);
  }, [current, currentStepId, goToStep, loading, steps]);

  const stepsValue = useMemo(() => ({ steps, current }), [steps, current]);

  if (current === -1) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // The stepper labels do not fit a phone, so phones get the bar.
  return (
    <WizardStepsContext.Provider value={stepsValue}>
      <div className="flex flex-col flex-1 min-h-0">
        {isMobile && <WizardHeader variant="bar" />}
        <main id="content" tabIndex={-1} className="flex-1 overflow-y-auto min-h-0">
          <div className={cx(!isMobile && 'mx-auto max-w-[108rem] pt-32 pb-64')}>
            <h1 className={isMobile ? 'sr-only' : 'text-h2-lg mb-24'}>{title}</h1>
            {!isMobile && <WizardHeader variant="stepper" />}
            <div className={cx(!isMobile && 'border-1 border-divider rounded-12 bg-background-content mt-24 px-24')}>
              <WizardStepContent />
            </div>
          </div>
        </main>
        <WizardBottomBar />
      </div>
    </WizardStepsContext.Provider>
  );
};
