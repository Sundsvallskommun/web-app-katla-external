import { getActiveWizardSteps, WizardStep } from '@components/wizard/wizard-steps';
import { useMemo } from 'react';
import { appConfig } from 'src/config/appconfig';

export function useActiveWizardSteps(): WizardStep[] {
  const otherPartiesEnabled = appConfig.features.otherPartiesDisclosure;

  return useMemo(() => getActiveWizardSteps(otherPartiesEnabled), [otherPartiesEnabled]);
}
