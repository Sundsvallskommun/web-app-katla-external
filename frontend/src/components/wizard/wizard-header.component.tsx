import { cx, ProgressBar, ProgressStepper } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';

import { wizardStepTitle } from './wizard-steps';
import { useWizardSteps } from './wizard-steps-context';

interface WizardHeaderProps {
  variant: 'bar' | 'stepper';
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({ variant }) => {
  const { t } = useTranslation();
  const { steps, current } = useWizardSteps();

  return (
    <div
      className={cx(
        'flex flex-col gap-12',
        variant === 'bar' && 'px-16 py-12 bg-background-content border-b-1 border-divider'
      )}
    >
      <span className="text-small font-bold">
        {t('errand-information:wizard.step_indicator', {
          current: current + 1,
          total: steps.length,
        })}
      </span>
      {variant === 'bar' ?
        <ProgressBar steps={steps.length} current={current + 1} size="sm" color="vattjom" />
      : <ProgressStepper
          steps={steps.map((step) => wizardStepTitle(step, t))}
          current={current}
          size="sm"
          labelPosition="bottom"
          // Section titles come from the schema and can be long; one row would overflow.
          noWrap={false}
          // Wrapped labels make the steps uneven in height; aligned at the top the numbers line up.
          className="items-start"
        />
      }
    </div>
  );
};
