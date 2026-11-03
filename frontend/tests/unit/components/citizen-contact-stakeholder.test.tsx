import { ErrandContentLock } from '@components/errand-content-lock/errand-content-lock.component';
import { StakeholderList } from '@components/misc/stakeholder.component';
import { MyStakeholderContext } from '@contexts/my-stakeholder-context';
import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/citizen/citizen-service', () => ({
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

const SELF_AS_CONTACT: StakeholderDTO = { ...SELF, role: 'CONTACT', externalIdType: 'PRIVATE' };

const OTHER_CONTACT: StakeholderDTO = {
  externalId: '',
  firstName: 'Bo',
  lastName: 'Bengtsson',
  role: 'CONTACT',
  externalIdType: 'PRIVATE',
};

const StakeholderProbe: React.FC = () => {
  const { watch } = useFormContext<ErrandFormDTO>();
  return <span data-testid="stakeholders">{JSON.stringify(watch('stakeholders'))}</span>;
};

const cards = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[data-cy="stakeholder-card"]'));

// `self: null` renders without a known citizen; the default argument would swallow `undefined`.
const renderList = (stakeholders: StakeholderDTO[], self: StakeholderDTO | null = SELF) => {
  const TestForm: React.FC = () => {
    const methods = useForm<ErrandFormDTO>({ defaultValues: { stakeholders } });

    return (
      <FormProvider {...methods}>
        <MyStakeholderContext.Provider value={self ?? undefined}>
          <ErrandContentLock>
            <StakeholderList roles={['CONTACT']} />
          </ErrandContentLock>
        </MyStakeholderContext.Provider>
        <StakeholderProbe />
      </FormProvider>
    );
  };

  return render(<TestForm />);
};

describe('StakeholderList and the citizen as contact person', () => {
  beforeEach(() => {
    useMetadataStore.setState({ metadata: { roles: [{ name: 'CONTACT', displayName: 'Kontakt' }] } });
  });

  it('no longer offers to add the citizen: they are on the errand from the start', () => {
    renderList([SELF_AS_CONTACT]);

    expect(document.querySelector('[data-cy="add-self-button"]')).toBeNull();
    expect(document.querySelector('[data-cy="add-manual-person-button"]')).toBeInTheDocument();
  });

  it('shows the citizen without a remove action, while other contacts keep theirs', () => {
    renderList([SELF_AS_CONTACT, OTHER_CONTACT]);

    const [citizen, other] = cards();
    expect(citizen).toHaveTextContent('Anna Andersson');
    expect(citizen.querySelector('[data-cy="remove-card-button"]')).toBeNull();
    expect(citizen.querySelector('[data-cy="edit-card-button"]')).toBeInTheDocument();
    expect(other.querySelector('[data-cy="remove-card-button"]')).toBeInTheDocument();
  });

  it('keeps the remove action when the citizen is unknown', () => {
    renderList([SELF_AS_CONTACT], null);

    expect(cards()[0].querySelector('[data-cy="remove-card-button"]')).toBeInTheDocument();
    expect(screen.getByTestId('stakeholders')).toHaveTextContent(SELF.externalId ?? '');
  });
});
