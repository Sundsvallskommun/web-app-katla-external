import { AboutErrandContent } from '@components/errand-sections/about-errand.component';
import { ErrandAttachmentsContent } from '@components/errand-sections/errand-attachments.component';
import { ErrandDetails } from '@components/errand-sections/errand-details.component';
import { ErrandOwnerContent } from '@components/errand-sections/errand-owner.component';
import { OtherPartiesContent } from '@components/errand-sections/other-parties.component';
import { useTranslation } from 'react-i18next';
import { useActiveWizardSteps } from 'src/hooks/use-active-wizard-steps';
import { useWizardStore } from 'src/stores/wizard-store';

import { WizardSummary } from './wizard-summary.component';

export const WizardStepContent: React.FC = () => {
  const { t } = useTranslation();
  const currentStep = useWizardStore((s) => s.currentStep);
  const steps = useActiveWizardSteps();
  const step = steps[currentStep];

  const renderStepContent = () => {
    switch (step?.id) {
      case 'about':
        return <AboutErrandContent />;
      case 'owner':
        return <ErrandOwnerContent />;
      case 'other-parties':
        return <OtherPartiesContent />;
      case 'details':
        return <ErrandDetails compact />;
      case 'attachments':
        return <ErrandAttachmentsContent />;
      case 'summary':
        return <WizardSummary />;
      default:
        return null;
    }
  };

  return (
    <div className="px-16 py-24">
      {step?.id !== 'summary' && <h2 className="text-h3-md mb-16">{t(step?.titleKey)}</h2>}
      {renderStepContent()}
    </div>
  );
};
