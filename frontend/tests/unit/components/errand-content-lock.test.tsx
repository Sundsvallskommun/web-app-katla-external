import { ErrandDisclosure } from '@components/disclosure/errand-information-disclosure.component';
import { ErrandContentLock } from '@components/errand-content-lock/errand-content-lock.component';
import { ErrandDTO } from '@data-contracts/backend/data-contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/config/appconfig', () => ({
  appConfig: { features: { disclosureDoneMark: false } },
}));

const ErrandForm: React.FC<{ children: React.ReactNode; id?: string; lifecycle?: ErrandDTO['lifecycle'] }> = ({
  children,
  id,
  lifecycle,
}) => {
  const methods = useForm<ErrandDTO>({ defaultValues: { id, lifecycle } });

  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('ErrandContentLock', () => {
  it('keeps controls enabled while the errand is being registered', () => {
    const { container } = render(
      <ErrandForm>
        <ErrandContentLock>
          <input aria-label="Ärenderubrik" />
        </ErrandContentLock>
      </ErrandForm>
    );

    expect(container.querySelector('fieldset')).not.toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Ärenderubrik' })).not.toBeDisabled();
  });

  it('keeps controls enabled for a resumed draft', () => {
    const { container } = render(
      <ErrandForm id="id-1" lifecycle="DRAFT">
        <ErrandContentLock>
          <input aria-label="Ärenderubrik" />
        </ErrandContentLock>
      </ErrandForm>
    );

    expect(container.querySelector('fieldset')).not.toBeDisabled();
  });

  it('disables controls once the errand has been filed', () => {
    const { container } = render(
      <ErrandForm id="id-1" lifecycle="ACTIVE">
        <ErrandContentLock>
          <input aria-label="Ärenderubrik" />
        </ErrandContentLock>
      </ErrandForm>
    );

    expect(container.querySelector('fieldset')).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Ärenderubrik' })).toBeDisabled();
  });

  it('keeps the disclosure toggle interactive for a sent errand', () => {
    const { container } = render(
      <ErrandForm id="id-1">
        <ErrandDisclosure header="Om ärendet" icon={<span aria-hidden="true" />} initialOpen={false}>
          <input aria-label="Ärenderubrik" />
        </ErrandDisclosure>
      </ErrandForm>
    );

    const toggle = screen.getByRole('button');
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('input')).toBeDisabled();
  });
});
