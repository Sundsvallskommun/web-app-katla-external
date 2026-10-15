import { ErrandContentLock } from '@components/errand-content-lock/errand-content-lock.component';
import { StakeholderList } from '@components/misc/stakeholder.component';
import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyStakeholderMock } = vi.hoisted(() => ({ getMyStakeholderMock: vi.fn() }));

vi.mock('@services/citizen/citizen-service', () => ({
  getMyStakeholder: getMyStakeholderMock,
  getStakeholderUsingPersonNumber: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Party id and person number are test values: the number is Skatteverket's, the id is arbitrary.
const SELF: StakeholderDTO = {
  externalId: 'f1e2d3c4-0000-4000-8000-000000000009',
  personNumber: '19900101-2385',
  firstName: 'Anna',
  lastName: 'Andersson',
  address: 'Storgatan 1',
  city: 'Sundsvall',
};

const StakeholderProbe: React.FC = () => {
  const { watch } = useFormContext<ErrandFormDTO>();
  return <span data-testid="stakeholders">{JSON.stringify(watch('stakeholders'))}</span>;
};

const getCy = (name: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
  if (!element) throw new Error(`No element with data-cy="${name}"`);
  return element;
};

const currentStakeholders = (): ErrandFormDTO['stakeholders'] => {
  const rendered = screen.getByTestId('stakeholders').textContent;
  return rendered ? (JSON.parse(rendered) as ErrandFormDTO['stakeholders']) : undefined;
};

const renderList = (allowAddSelf = true, stakeholders: StakeholderDTO[] = []) => {
  const TestForm: React.FC = () => {
    const methods = useForm<ErrandFormDTO>({ defaultValues: { stakeholders } });

    return (
      <FormProvider {...methods}>
        <ErrandContentLock>
          <StakeholderList roles={['CONTACT']} allowAddSelf={allowAddSelf} />
        </ErrandContentLock>
        <StakeholderProbe />
      </FormProvider>
    );
  };

  return render(<TestForm />);
};

describe('StakeholderList add self', () => {
  beforeEach(() => {
    getMyStakeholderMock.mockReset();
    useMetadataStore.setState({ metadata: { roles: [{ name: 'CONTACT', displayName: 'Kontakt' }] } });
  });

  it('is not offered unless the list allows it', () => {
    renderList(false);

    expect(document.querySelector('[data-cy="add-self-button"]')).toBeNull();
  });

  it('adds the citizen as a stakeholder in one click and withdraws the offer', async () => {
    getMyStakeholderMock.mockResolvedValue({ data: SELF });
    renderList();

    fireEvent.click(getCy('add-self-button'));

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([{ ...SELF, role: 'CONTACT', externalIdType: 'PRIVATE' }]);
    });
    expect(document.querySelector('[data-cy="add-self-button"]')).toBeNull();
    expect(document.querySelector('[data-cy="search-result"]')).toBeNull();
    expect(getCy('stakeholder-card')).toHaveTextContent('Anna Andersson');
  });

  it('does not add the citizen twice when a reloaded draft already lists them', async () => {
    getMyStakeholderMock.mockResolvedValue({ data: SELF });
    renderList(true, [{ ...SELF, role: 'CONTACT', emails: ['anna@example.com'] }]);

    fireEvent.click(getCy('add-self-button'));

    await waitFor(() => {
      expect(document.querySelector('[data-cy="add-self-button"]')).toBeNull();
    });
    expect(currentStakeholders()).toEqual([{ ...SELF, role: 'CONTACT', emails: ['anna@example.com'] }]);
  });

  it('offers the citizen again once they are removed', async () => {
    getMyStakeholderMock.mockResolvedValue({ data: SELF });
    renderList();

    fireEvent.click(getCy('add-self-button'));
    await waitFor(() => {
      expect(document.querySelector('[data-cy="add-self-button"]')).toBeNull();
    });

    fireEvent.click(getCy('remove-card-button'));

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([]);
    });
    expect(getCy('add-self-button')).toBeInTheDocument();
  });

  it('tells the citizen when their details could not be fetched', async () => {
    getMyStakeholderMock.mockRejectedValue(new Error('upstream'));
    renderList();

    fireEvent.click(getCy('add-self-button'));

    await screen.findByText('errand-information:stakeholder.self_lookup_failed');
    expect(currentStakeholders()).toEqual([]);
    expect(getCy('add-self-button')).toBeInTheDocument();
  });
});
