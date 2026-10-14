import { FormValidationProvider } from '@contexts/form-validation-provider';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import { ErrandButtonGroup } from '@layouts/errand-button-group.component';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createErrandMock, routerPushMock, snackbarMock, updateErrandMock, validateErrandFormDataMock } = vi.hoisted(
  () => ({
    createErrandMock: vi.fn(),
    routerPushMock: vi.fn(),
    snackbarMock: vi.fn(),
    updateErrandMock: vi.fn(),
    validateErrandFormDataMock: vi.fn(),
  })
);

// These cases are about categorization and ownership. What makes the form data valid is a
// separate precondition, covered in json/schema-utils.test.ts; here it only answers.
vi.mock('@components/json/utils/schema-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@components/json/utils/schema-utils')>()),
  validateErrandFormData: validateErrandFormDataMock,
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

vi.mock('src/config/appconfig', () => ({
  appConfig: { features: { draftEnabled: true } },
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

  const cx = (...classNames: unknown[]) => classNames.filter(Boolean).join(' ');

  return { Button, cx, Dialog, useSnackbar: () => snackbarMock };
});

const OWNER: ErrandFormDTO['stakeholders'] = [
  { role: 'PRIMARY', externalId: 'f1e2d3c4-0000-4000-8000-000000000001', organizationName: 'Acme Restaurang AB' },
];

const CLASSIFICATION: ErrandFormDTO['labels'] = [
  { id: 'alkohol', classification: 'CATEGORY' },
  { id: 'folkol', classification: 'TYPE' },
];

const renderButtons = (defaultValues: Partial<ErrandFormDTO> = {}) => {
  const TestForm: React.FC = () => {
    const methods = useForm<ErrandFormDTO>({ defaultValues });

    return (
      <FormProvider {...methods}>
        <FormValidationProvider>
          <ErrandButtonGroup isNewErrand />
        </FormValidationProvider>
      </FormProvider>
    );
  };

  return render(<TestForm />);
};

describe('What registration requires before it will submit', () => {
  beforeEach(() => {
    createErrandMock.mockReset();
    routerPushMock.mockReset();
    snackbarMock.mockReset();
    updateErrandMock.mockReset();
    validateErrandFormDataMock.mockReset();
    validateErrandFormDataMock.mockResolvedValue([]);
  });

  const clickRegister = () => {
    fireEvent.click(screen.getByRole('button', { name: 'errand-information:register' }));
  };

  const expectReported = async (message: string) => {
    await waitFor(() => {
      expect(snackbarMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', message }));
    });
    expect(screen.queryByRole('button', { name: 'errand-information:submit_confirm.submit' })).not.toBeInTheDocument();
  };

  it('refuses to register an errand that has not been categorized', async () => {
    renderButtons({ stakeholders: OWNER });

    clickRegister();

    await expectReported('validation:categorization.category_required');
  });

  it('asks for the type once the category is chosen', async () => {
    renderButtons({ labels: [{ id: 'alkohol', classification: 'CATEGORY' }], stakeholders: OWNER });

    clickRegister();

    await expectReported('validation:categorization.type_required');
  });

  it('refuses to register an errand with no owner', async () => {
    renderButtons({ labels: CLASSIFICATION });

    clickRegister();

    await expectReported('validation:owner.required');
  });

  it('opens the confirmation once the errand is categorized and has an owner', async () => {
    renderButtons({ labels: CLASSIFICATION, stakeholders: OWNER });

    clickRegister();

    expect(await screen.findByRole('button', { name: 'errand-information:submit_confirm.submit' })).toBeInTheDocument();
    expect(snackbarMock).not.toHaveBeenCalled();
  });

  const clickSaveDraft = () => {
    fireEvent.click(screen.getByRole('button', { name: 'errand-information:save_draft' }));
  };

  // Reading is scoped by the owner's organisation, so a draft saved without one would be lost.
  it('refuses to save a draft with no owner', async () => {
    renderButtons({ labels: CLASSIFICATION });

    clickSaveDraft();

    await expectReported('validation:owner.required');
    expect(createErrandMock).not.toHaveBeenCalled();
  });

  // Upstream validates the filed answers against the schema, so an invalid form would be a 400.
  it('refuses to save a draft whose filled-in form fails its schema', async () => {
    validateErrandFormDataMock.mockResolvedValue(['form_field_error']);
    renderButtons({ stakeholders: OWNER });

    clickSaveDraft();

    await expectReported('form_field_error');
    expect(createErrandMock).not.toHaveBeenCalled();
  });

  it('saves a draft that has an owner, before anything else is filled in', async () => {
    createErrandMock.mockResolvedValue({ id: 'id-1', errandNumber: 'AOT-1', jsonParameters: [] });
    renderButtons({ stakeholders: OWNER });

    clickSaveDraft();

    await waitFor(() => {
      expect(createErrandMock).toHaveBeenCalledWith(
        expect.objectContaining({ lifecycle: 'DRAFT', stakeholders: OWNER })
      );
    });
    expect(snackbarMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });
});
