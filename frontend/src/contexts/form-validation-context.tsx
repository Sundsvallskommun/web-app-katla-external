'use client';

import { createContext, useContext } from 'react';

export interface FormValidationContextType {
  showValidation: boolean;
  setShowValidation: (show: boolean) => void;
  /** Moves focus to the first field showing a validation error and scrolls it into view. */
  focusFirstError: () => void;
}

export const FormValidationContext = createContext<FormValidationContextType | undefined>(undefined);

export function useFormValidation() {
  const context = useContext(FormValidationContext);
  if (!context) {
    throw new Error('useFormValidation must be used within FormValidationProvider');
  }
  return context;
}
