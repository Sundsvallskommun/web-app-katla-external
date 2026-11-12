import { create } from 'zustand';
import { persist, StorageValue } from 'zustand/middleware';

/**
 * The step is kept by id: the step list depends on the errand type's form, so a position would
 * point at another step once the form's sections are known.
 */
interface WizardState {
  currentStepId: string;
  stepErrors: Record<string, string[]>;
  goToStep: (stepId: string) => void;
  setStepErrors: (stepId: string, errors: string[]) => void;
  reset: () => void;
}

const FIRST_STEP_ID = 'about';

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      currentStepId: FIRST_STEP_ID,
      stepErrors: {},
      goToStep: (stepId) => set({ currentStepId: stepId }),
      setStepErrors: (stepId, errors) => set((state) => ({ stepErrors: { ...state.stepErrors, [stepId]: errors } })),
      reset: () => set({ currentStepId: FIRST_STEP_ID, stepErrors: {} }),
    }),
    {
      name: 'wizard-storage',
      // Version 0 stored positions, which do not translate to ids.
      version: 1,
      migrate: () => ({ currentStepId: FIRST_STEP_ID, stepErrors: {} }) as WizardState,
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? (JSON.parse(str) as StorageValue<WizardState>) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
    }
  )
);
