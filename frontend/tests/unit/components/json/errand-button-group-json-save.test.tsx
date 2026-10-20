import { FormValidationProvider } from '@contexts/form-validation-provider';
import { mockOrganization } from '@e2e/fixtures/getMyOrganizations';
import { ownerStakeholderFor } from '@e2e/fixtures/getOwnerStakeholder';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import { ErrandButtonGroup } from '@layouts/errand-button-group.component';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createErrandMock, routerPushMock, snackbarMock, updateErrandMock } = vi.hoisted(() => ({
  createErrandMock: vi.fn(),
  routerPushMock: vi.fn(),
  snackbarMock: vi.fn(),
  updateErrandMock: vi.fn(),
}));

vi.mock('@components/cancel-errand-dialog.component', () => ({
  CancelErrandDialog: () => null,
}));

vi.mock('@services/errand-service/errand-service', () => ({
  createErrand: createErrandMock,
  updateErrand: updateErrandMock,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ service: 'alkoholtillstand' }),
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'sv' } }),
}));

vi.mock('@sk-web-gui/react', () => {
  const Button = ({ children, onClick }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
  const Dialog = ({ children, show }: { children?: ReactNode; show?: boolean }) =>
    show ? <div>{children}</div> : null;
  function DialogContent({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  function DialogButtons({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  Dialog.Content = DialogContent;
  Dialog.Buttons = DialogButtons;

  return {
    Button,
    Dialog,
    useSnackbar: () => snackbarMock,
  };
});

function TestForm() {
  const methods = useForm<ErrandFormDTO>({
    defaultValues: {
      // Registration refuses an errand without an owner before it looks at the form data.
      stakeholders: [ownerStakeholderFor(mockOrganization)],
      // Labels select the schema; without them the broken entry is filtered out before the save.
      labels: [
        { id: 'alkohol', classification: 'CATEGORY', resourceName: 'ALCOHOL' },
        { id: 'servering', classification: 'TYPE', resourceName: 'SERVING_PERMIT_APPLICATION' },
        { id: 'stadigvarande', classification: 'SUBTYPE', resourceName: 'PERMANENT_SERVING' },
      ],
      errandFormData: [
        {
          schemaName: 'aot_alcohol_serving_permit_application_permanent_serving',
          schemaId: 'schema-v1',
          data: '{invalid-json',
        },
      ],
    },
  });

  return (
    <FormProvider {...methods}>
      <FormValidationProvider>
        <ErrandButtonGroup isNewErrand />
      </FormValidationProvider>
    </FormProvider>
  );
}

describe('ErrandButtonGroup JSON save contract', () => {
  beforeEach(() => {
    useMetadataStore.setState({ metadata: { namespace: 'AOT' } });
    createErrandMock.mockReset();
    routerPushMock.mockReset();
    snackbarMock.mockReset();
    updateErrandMock.mockReset();
  });

  it('handles invalid persisted JSON without calling the save API', async () => {
    render(<TestForm />);

    fireEvent.click(screen.getByRole('button', { name: 'errand-information:register' }));

    await waitFor(() => {
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'invalid_form_data',
        })
      );
    });
    expect(createErrandMock).not.toHaveBeenCalled();
    expect(updateErrandMock).not.toHaveBeenCalled();
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
