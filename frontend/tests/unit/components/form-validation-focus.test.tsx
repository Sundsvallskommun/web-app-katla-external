import { useFormValidation } from '@contexts/form-validation-context';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { INVALID_FIELD_ATTRIBUTE } from '@utils/focus-first-error';
import { describe, expect, it } from 'vitest';

function ValidationHarness() {
  const { showValidation, setShowValidation, focusFirstError } = useFormValidation();

  return (
    <>
      <label htmlFor="summary">Sammanfattning</label>
      <div {...(showValidation ? { [INVALID_FIELD_ATTRIBUTE]: 'summary' } : {})}>
        <input id="summary" />
      </div>
      <button
        type="button"
        onClick={() => {
          setShowValidation(true);
          focusFirstError();
        }}
      >
        Registrera
      </button>
    </>
  );
}

describe('FormValidationProvider', () => {
  it('moves focus to the field flagged as invalid in the same update', async () => {
    const user = userEvent.setup();
    render(
      <FormValidationProvider>
        <ValidationHarness />
      </FormValidationProvider>
    );

    const input = screen.getByRole('textbox', { name: 'Sammanfattning' });
    expect(input).not.toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Registrera' }));

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });
});
