import { Button, Label } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from 'src/stores/wizard-store';

import { wizardStepTitle } from './wizard-steps';
import { useWizardSteps } from './wizard-steps-context';

export const WizardSummary: React.FC = () => {
  const { t } = useTranslation();
  const { steps, goToStep } = useWizardSteps();
  const stepErrors = useWizardStore((s) => s.stepErrors);

  const stepsToReview = steps.filter((s) => s.id !== 'summary');

  return (
    <div className="flex flex-col gap-16">
      {stepsToReview.map((step) => {
        const hasErrors = (stepErrors[step.id] ?? []).length > 0;
        return (
          <div
            key={step.id}
            data-cy={`wizard-summary-${step.id}`}
            className="flex items-center justify-between border-1 border-divider rounded-12 p-16"
          >
            <div className="flex items-center gap-12">
              <Label color={hasErrors ? 'error' : 'vattjom'} inverted rounded>
                {hasErrors ? t('errand-information:wizard.incomplete') : t('errand-information:wizard.complete')}
              </Label>
              <span className="font-bold">{wizardStepTitle(step, t)}</span>
            </div>
            <Button
              size="sm"
              variant="link"
              onClick={() => {
                goToStep(step.id);
              }}
            >
              {t('errand-information:wizard.edit')}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
