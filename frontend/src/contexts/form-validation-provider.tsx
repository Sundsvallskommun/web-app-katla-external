'use client';

import { FormValidationContext } from '@contexts/form-validation-context';
import { focusFirstInvalidField } from '@utils/focus-first-error';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

// Split out so the context file exports only non-components (react-refresh/only-export-components).
export function FormValidationProvider({ children }: { children: ReactNode }) {
  const [showValidation, setShowValidation] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  const focusFirstError = useCallback(() => {
    setFocusRequest((request) => request + 1);
  }, []);

  // Errors render in the same update that turns validation on, and expanding sections update in
  // turn. Focus therefore waits a frame so the field is there to reach.
  useEffect(() => {
    if (focusRequest === 0) return undefined;

    const frame = requestAnimationFrame(() => {
      focusFirstInvalidField();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [focusRequest]);

  const value = useMemo(
    () => ({ showValidation, setShowValidation, focusFirstError }),
    [showValidation, focusFirstError]
  );

  return <FormValidationContext.Provider value={value}>{children}</FormValidationContext.Provider>;
}
