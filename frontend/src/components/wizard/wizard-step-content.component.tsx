import { AboutErrandContent } from '@components/errand-sections/about-errand.component';
import { ErrandAttachmentsContent } from '@components/errand-sections/errand-attachments.component';
import { ErrandDetails } from '@components/errand-sections/errand-details.component';
import { ErrandOwnerContent } from '@components/errand-sections/errand-owner.component';
import { OtherPartiesContent } from '@components/errand-sections/other-parties.component';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MOBILE_BREAKPOINT } from 'src/constants/responsive';
import { useMediaQuery } from 'src/hooks/use-media-query';

import { wizardStepTitle } from './wizard-steps';
import { useWizardSteps } from './wizard-steps-context';
import { WizardSummary } from './wizard-summary.component';

export const WizardStepContent: React.FC = () => {
  const { t } = useTranslation();
  const { step } = useWizardSteps();
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step.id);

  // A step change replaces the content under the user's focus. Moving focus to the new heading
  // tells screen readers where they are; the first render keeps the page's own focus.
  useEffect(() => {
    if (shownStep.current === step.id) return;
    shownStep.current = step.id;
    const heading = headingRef.current;
    if (!heading) return;
    const main = heading.closest('main');
    if (main) main.scrollTop = 0;
    heading.focus({ preventScroll: true });
  }, [step.id]);

  const renderStepContent = () => {
    if (step.kind === 'section') {
      // Keyed per step: a reused form would carry the previous section's errors over.
      return <ErrandDetails key={step.id} compact={isMobile} section={step.section} />;
    }
    switch (step.id) {
      case 'about':
        return <AboutErrandContent />;
      case 'owner':
        return <ErrandOwnerContent />;
      case 'other-parties':
        return <OtherPartiesContent />;
      case 'details':
        return <ErrandDetails compact={isMobile} />;
      case 'attachments':
        return <ErrandAttachmentsContent />;
      case 'summary':
        return <WizardSummary />;
    }
  };

  return (
    <div className="px-16 py-24">
      <h2 ref={headingRef} tabIndex={-1} data-cy="wizard-step-title" className="text-h3-md mb-16 focus:outline-none">
        {wizardStepTitle(step, t)}
      </h2>
      {renderStepContent()}
    </div>
  );
};
