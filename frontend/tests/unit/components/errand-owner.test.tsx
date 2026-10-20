import { ErrandContentLock } from '@components/errand-content-lock/errand-content-lock.component';
import { ErrandOwnerContent } from '@components/errand-sections/errand-owner.component';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { mockOrganization, mockSecondOrganization } from '@e2e/fixtures/getMyOrganizations';
import { ownerStakeholderFor } from '@e2e/fixtures/getOwnerStakeholder';
import { mockSelfStakeholder } from '@e2e/fixtures/mockStakeholder';
import { MOCK_COUNTRY_CODE_PHONE_NUMBER, MOCK_HYPHEN_PERSON_NUMBER, MOCK_PHONE_NUMBER } from '@e2e/utils/constants';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyOrganizationsMock, getMyStakeholderMock, getOwnerStakeholderMock } = vi.hoisted(() => ({
  getMyOrganizationsMock: vi.fn(),
  getMyStakeholderMock: vi.fn(),
  getOwnerStakeholderMock: vi.fn(),
}));

vi.mock('@services/organization-service/organization-service', () => ({
  getMyOrganizations: getMyOrganizationsMock,
  getOwnerStakeholder: getOwnerStakeholderMock,
}));

vi.mock('@services/citizen/citizen-service', () => ({
  getMyStakeholder: getMyStakeholderMock,
  getStakeholderUsingPersonNumber: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('src/config/appconfig', () => ({
  appConfig: { features: { disclosureDoneMark: false } },
}));

const SELF_AS_OWNER: StakeholderDTO = { ...mockSelfStakeholder, role: 'PRIMARY', externalIdType: 'PRIVATE' };
const SELF_NAME = `${mockSelfStakeholder.firstName ?? ''} ${mockSelfStakeholder.lastName ?? ''}`;

// Rendered rather than captured in a variable: reassigning during render is a side effect, and
// the DOM is what the assertions can wait on anyway.
const StakeholderProbe: React.FC = () => {
  const { watch } = useFormContext<ErrandFormDTO>();
  return <span data-testid="stakeholders">{JSON.stringify(watch('stakeholders'))}</span>;
};

/** The app marks test targets with data-cy, which is not RTL's default testId attribute. */
const queryCy = (name: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-cy="${name}"]`);

/** As queryCy, for targets that must exist: a missing one is a broken test, not a null check. */
const getCy = (name: string): HTMLElement => {
  const element = queryCy(name);
  if (!element) throw new Error(`No element with data-cy="${name}"`);
  return element;
};

const currentStakeholders = (): ErrandFormDTO['stakeholders'] => {
  const rendered = screen.getByTestId('stakeholders').textContent;
  return rendered ? (JSON.parse(rendered) as ErrandFormDTO['stakeholders']) : undefined;
};

const renderOwner = (defaultValues: Partial<ErrandFormDTO> = {}) => {
  const TestForm: React.FC = () => {
    const methods = useForm<ErrandFormDTO>({ defaultValues });

    return (
      <FormProvider {...methods}>
        <FormValidationProvider>
          <ErrandContentLock>
            <ErrandOwnerContent />
          </ErrandContentLock>
          <StakeholderProbe />
        </FormValidationProvider>
      </FormProvider>
    );
  };

  return render(<TestForm />);
};

describe('ErrandOwner', () => {
  beforeEach(() => {
    getMyOrganizationsMock.mockReset();
    // Details unavailable unless a test says otherwise.
    getOwnerStakeholderMock.mockReset().mockRejectedValue(new Error('unavailable'));
    getMyStakeholderMock.mockReset().mockResolvedValue({ data: mockSelfStakeholder });
    // The owner card labels itself rather than looking the role up in metadata, which does not
    // name PRIMARY in this namespace. Seeded with a wrong label so a regression to the lookup shows.
    useMetadataStore.setState({ metadata: { roles: [{ name: 'PRIMARY', displayName: 'Fel etikett' }] } });
  });

  it('lists the organizations the citizen has engagements in', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    renderOwner();

    const select = await screen.findByRole('combobox');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['errand-information:owner.select_placeholder', 'Acme Restaurang AB', 'Bolaget Krog HB']);
  });

  it('files the chosen organization as the primary stakeholder even when its details cannot be read', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockSecondOrganization.partyId } });

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([
        {
          role: 'PRIMARY',
          externalId: mockSecondOrganization.partyId,
          externalIdType: 'COMPANY',
          organizationName: 'Bolaget Krog HB',
        },
      ]);
    });
    expect(getOwnerStakeholderMock).toHaveBeenCalledWith(mockSecondOrganization.partyId);
  });

  it('completes the chosen organization with the number and address the backend resolves', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    getOwnerStakeholderMock.mockResolvedValue(ownerStakeholderFor(mockSecondOrganization));
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockSecondOrganization.partyId } });

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([ownerStakeholderFor(mockSecondOrganization)]);
    });
    expect(queryCy('stakeholder-organizationNumber')).toHaveTextContent('222222-3333');
    expect(queryCy('stakeholder-address')).toHaveTextContent('Registrerad gata 5 85100 Sundsvall');
  });

  it('drops details that arrive after the owner was changed', async () => {
    let resolveAcme: (details: StakeholderDTO) => void = () => undefined;
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    getOwnerStakeholderMock.mockImplementation((partyId: string) =>
      partyId === mockOrganization.partyId ?
        new Promise<StakeholderDTO>((resolve) => {
          resolveAcme = resolve;
        })
      : Promise.reject(new Error('unavailable'))
    );
    renderOwner();

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: mockOrganization.partyId } });
    fireEvent.change(select, { target: { value: mockSecondOrganization.partyId } });
    resolveAcme(ownerStakeholderFor(mockOrganization));

    await waitFor(() => {
      expect(getOwnerStakeholderMock).toHaveBeenCalledTimes(2);
    });
    expect(currentStakeholders()).toEqual([expect.objectContaining({ externalId: mockSecondOrganization.partyId })]);
    expect(currentStakeholders()?.[0]).not.toHaveProperty('address');
  });

  it('replaces the owner rather than adding a second one, keeping other stakeholders', async () => {
    const contact = { role: 'CONTACT', firstName: 'Anna', lastName: 'Andersson' };
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    renderOwner({ stakeholders: [contact] });

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: mockOrganization.partyId } });
    fireEvent.change(select, { target: { value: mockSecondOrganization.partyId } });

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([
        contact,
        expect.objectContaining({ role: 'PRIMARY', externalId: mockSecondOrganization.partyId }),
      ]);
    });
  });

  // Applying as a private person is the other choice, so a sole organisation is not preselected.
  it('offers the only organization without preselecting it', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
    renderOwner();

    expect(await screen.findByRole('combobox')).toHaveValue('');
    expect(queryCy('add-self-owner-button')).toBeInTheDocument();
    expect(currentStakeholders()).toBeUndefined();
  });

  it('leaves a submitted errand alone rather than preselecting into it', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
    renderOwner({ id: 'id-1', status: 'NEW' });

    await waitFor(() => {
      expect(getMyOrganizationsMock).toHaveBeenCalled();
    });
    // The select belongs to editing; a submitted errand shows only the card it was filed with.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(currentStakeholders()).toBeUndefined();
  });

  it('shows the errand owner selected on a loaded errand', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    renderOwner({
      stakeholders: [
        {
          role: 'PRIMARY',
          externalId: mockSecondOrganization.partyId,
          externalIdType: 'COMPANY',
          organizationName: 'Bolaget Krog HB',
        },
      ],
    });

    expect(await screen.findByRole('combobox')).toHaveValue(mockSecondOrganization.partyId);
    expect(queryCy('stakeholder-name')).toHaveTextContent('Bolaget Krog HB');
  });

  it('renders the chosen organization as a card with its organization number', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockOrganization.partyId } });

    await waitFor(() => {
      expect(queryCy('stakeholder-card')).toBeInTheDocument();
    });
    expect(queryCy('stakeholder-name')).toHaveTextContent('Acme Restaurang AB');
    expect(queryCy('stakeholder-organizationNumber')).toHaveTextContent(mockOrganization.organizationNumber);
    expect(queryCy('stakeholder-role')).toHaveTextContent('errand-information:owner.role_label');
    // An organisation has no person contact details to show.
    expect(queryCy('stakeholder-email')).toBeNull();
  });

  it('removes the owner from the card action', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockOrganization.partyId } });
    await waitFor(() => {
      expect(queryCy('stakeholder-card')).toBeInTheDocument();
    });

    fireEvent.click(getCy('remove-owner-button'));

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([]);
    });
    expect(queryCy('stakeholder-card')).toBeNull();
    expect(await screen.findByRole('combobox')).toHaveValue('');
  });

  it('keeps the contact details entered for the owner, and shows them on the card', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockOrganization.partyId } });
    await waitFor(() => {
      expect(queryCy('stakeholder-card')).toBeInTheDocument();
    });
    fireEvent.click(getCy('edit-owner-button'));

    // Identity is shown for recognition but never editable here.
    expect(queryCy('owner-organizationNumber')).toHaveValue(mockOrganization.organizationNumber);
    expect(queryCy('owner-organizationNumber')).toHaveAttribute('readonly');
    expect(queryCy('owner-organizationName')).toHaveAttribute('readonly');

    fireEvent.change(getCy('owner-address-input'), { target: { value: 'Storgatan 1' } });
    fireEvent.change(getCy('owner-zipCode-input'), { target: { value: '85230' } });
    fireEvent.change(getCy('owner-city-input'), { target: { value: 'Sundsvall' } });
    fireEvent.change(getCy('owner-phone-input'), { target: { value: MOCK_PHONE_NUMBER } });
    fireEvent.click(getCy('owner-phone-add'));
    fireEvent.change(getCy('owner-email-input'), { target: { value: 'post@acme.se' } });
    fireEvent.click(getCy('owner-email-add'));
    fireEvent.click(getCy('owner-modal-save'));

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([
        expect.objectContaining({
          role: 'PRIMARY',
          externalId: mockOrganization.partyId,
          address: 'Storgatan 1',
          zipCode: '85230',
          city: 'Sundsvall',
          phoneNumbers: [MOCK_COUNTRY_CODE_PHONE_NUMBER],
          emails: ['post@acme.se'],
        }),
      ]);
    });
    expect(queryCy('stakeholder-email')).toHaveTextContent('post@acme.se');
    expect(queryCy('stakeholder-phonenumber')).toHaveTextContent(MOCK_COUNTRY_CODE_PHONE_NUMBER);
  });

  // Draken stops the case without them, so the modal refuses rather than the registration later.
  it('refuses to save the owner without street, postal code, city and a phone number', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockOrganization.partyId } });
    await waitFor(() => {
      expect(queryCy('stakeholder-card')).toBeInTheDocument();
    });
    fireEvent.click(getCy('edit-owner-button'));
    fireEvent.click(getCy('owner-modal-save'));

    await waitFor(() => {
      expect(queryCy('owner-address-error')).toHaveTextContent('validation:owner.address_required');
    });
    expect(queryCy('owner-zipCode-error')).toHaveTextContent('validation:owner.zip_code_required');
    expect(queryCy('owner-city-error')).toHaveTextContent('validation:owner.city_required');
    expect(queryCy('owner-phone-error')).toHaveTextContent('validation:owner.phone_required');
    expect(currentStakeholders()?.[0]).not.toHaveProperty('address');
  });

  it('says on the card what the chosen organization still lacks', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockOrganization.partyId } });

    await waitFor(() => {
      expect(queryCy('stakeholder-address')).toHaveTextContent('errand-information:stakeholder.missing_address');
    });
    expect(queryCy('stakeholder-phonenumber')).toHaveTextContent('errand-information:stakeholder.missing_phone');
  });

  it('refuses an invalid e-mail rather than attaching it to the errand', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
    renderOwner();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockOrganization.partyId } });
    await waitFor(() => {
      expect(queryCy('stakeholder-card')).toBeInTheDocument();
    });
    fireEvent.click(getCy('edit-owner-button'));
    fireEvent.change(getCy('owner-email-input'), { target: { value: 'inte-en-adress' } });
    fireEvent.click(getCy('owner-email-add'));

    await waitFor(() => {
      expect(queryCy('owner-email-error')).toBeInTheDocument();
    });
    expect(queryCy('owner-email-value')).toBeNull();
  });

  it('clearing the choice drops the owner', async () => {
    getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
    renderOwner();

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: mockOrganization.partyId } });
    await waitFor(() => {
      expect(queryCy('stakeholder-card')).toBeInTheDocument();
    });

    fireEvent.change(select, { target: { value: '' } });

    await waitFor(() => {
      expect(currentStakeholders()).toEqual([]);
    });
    expect(queryCy('stakeholder-card')).toBeNull();
  });

  it('reports an error instead of an empty list when the organizations cannot be read', async () => {
    getMyOrganizationsMock.mockRejectedValue(new Error('boom'));
    renderOwner();

    expect(await screen.findByRole('alert')).toHaveTextContent('api_errors.organizations');
    expect(screen.queryByText('errand-information:owner.no_organizations')).not.toBeInTheDocument();
  });

  it('says so when the citizen has no organizations to file for, and still offers themself', async () => {
    getMyOrganizationsMock.mockResolvedValue([]);
    renderOwner();

    expect(await screen.findByText('errand-information:owner.no_organizations')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(queryCy('add-self-owner-button')).toBeInTheDocument();
  });

  describe('as a private person', () => {
    it('files the citizen as the primary stakeholder, resolved from the session', async () => {
      getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
      renderOwner();

      fireEvent.click(await screen.findByText('errand-information:stakeholder.add_self'));

      await waitFor(() => {
        expect(currentStakeholders()).toEqual([SELF_AS_OWNER]);
      });
      expect(getOwnerStakeholderMock).not.toHaveBeenCalled();
    });

    it('drops the citizen contact entry when they become the owner', async () => {
      getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
      const otherContact: StakeholderDTO = { externalId: '', firstName: 'Bo', lastName: 'Bengtsson', role: 'CONTACT' };
      renderOwner({
        stakeholders: [{ ...mockSelfStakeholder, role: 'CONTACT', externalIdType: 'PRIVATE' }, otherContact],
      });

      fireEvent.click(await screen.findByText('errand-information:stakeholder.add_self'));

      await waitFor(() => {
        expect(currentStakeholders()).toEqual([otherContact, SELF_AS_OWNER]);
      });
    });

    it('shows the citizen as the owner card and hides the organization picker meanwhile', async () => {
      getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
      renderOwner();

      fireEvent.click(await screen.findByText('errand-information:stakeholder.add_self'));

      await waitFor(() => {
        expect(queryCy('stakeholder-card')).toBeInTheDocument();
      });
      expect(queryCy('stakeholder-name')).toHaveTextContent(SELF_NAME);
      expect(queryCy('stakeholder-personNumber')).toHaveTextContent(MOCK_HYPHEN_PERSON_NUMBER);
      expect(queryCy('stakeholder-address')).toHaveTextContent('Storgatan 1 85230 Sundsvall');
      expect(queryCy('stakeholder-role')).toHaveTextContent('errand-information:owner.role_label');
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(queryCy('add-self-owner-button')).toBeNull();
    });

    it('offers the organizations and the citizen again once the owner is removed', async () => {
      getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
      renderOwner();

      fireEvent.click(await screen.findByText('errand-information:stakeholder.add_self'));
      await waitFor(() => {
        expect(queryCy('stakeholder-card')).toBeInTheDocument();
      });
      fireEvent.click(getCy('remove-owner-button'));

      await waitFor(() => {
        expect(currentStakeholders()).toEqual([]);
      });
      expect(await screen.findByRole('combobox')).toHaveValue('');
      expect(queryCy('add-self-owner-button')).toBeInTheDocument();
    });

    it('replaces an organization owner rather than adding a second owner', async () => {
      const contact = { role: 'CONTACT', firstName: 'Bo', lastName: 'Berg' };
      getMyOrganizationsMock.mockResolvedValue([mockOrganization, mockSecondOrganization]);
      renderOwner({ stakeholders: [contact] });

      fireEvent.change(await screen.findByRole('combobox'), { target: { value: mockOrganization.partyId } });
      await waitFor(() => {
        expect(queryCy('stakeholder-card')).toBeInTheDocument();
      });
      // The picker is only replaced by the button once the owner is removed.
      expect(queryCy('add-self-owner-button')).toBeNull();
      fireEvent.click(getCy('remove-owner-button'));
      fireEvent.click(await screen.findByText('errand-information:stakeholder.add_self'));

      await waitFor(() => {
        expect(currentStakeholders()).toEqual([contact, SELF_AS_OWNER]);
      });
    });

    it('reports a failed lookup and leaves the errand without an owner', async () => {
      getMyOrganizationsMock.mockResolvedValue([]);
      getMyStakeholderMock.mockRejectedValue(new Error('boom'));
      renderOwner();

      fireEvent.click(await screen.findByText('errand-information:stakeholder.add_self'));

      expect(await screen.findByText('errand-information:owner.self_lookup_failed')).toBeInTheDocument();
      expect(currentStakeholders()).toBeUndefined();
      expect(queryCy('add-self-owner-button')).toBeInTheDocument();
    });

    it('shows the identity read-only and keeps the address entered for a private owner', async () => {
      getMyOrganizationsMock.mockResolvedValue([]);
      renderOwner();

      fireEvent.click(await screen.findByText('errand-information:stakeholder.add_self'));
      await waitFor(() => {
        expect(queryCy('stakeholder-card')).toBeInTheDocument();
      });
      fireEvent.click(getCy('edit-owner-button'));

      expect(queryCy('owner-personNumber')).toHaveValue(MOCK_HYPHEN_PERSON_NUMBER);
      expect(queryCy('owner-personNumber')).toHaveAttribute('readonly');
      expect(queryCy('owner-name')).toHaveValue(SELF_NAME);
      expect(queryCy('owner-organizationNumber')).toBeNull();

      fireEvent.change(getCy('owner-careOf-input'), { target: { value: 'c/o Festlokalen' } });
      // The citizen record carries no phone, so the owner adds one.
      fireEvent.change(getCy('owner-phone-input'), { target: { value: MOCK_PHONE_NUMBER } });
      fireEvent.click(getCy('owner-phone-add'));
      fireEvent.click(getCy('owner-modal-save'));

      await waitFor(() => {
        expect(currentStakeholders()).toEqual([
          { ...SELF_AS_OWNER, careOf: 'c/o Festlokalen', phoneNumbers: [MOCK_COUNTRY_CODE_PHONE_NUMBER] },
        ]);
      });
      expect(queryCy('stakeholder-address')).toHaveTextContent('Storgatan 1 c/o Festlokalen 85230 Sundsvall');
    });

    it('shows a filed private owner on a loaded errand', async () => {
      getMyOrganizationsMock.mockResolvedValue([mockOrganization]);
      renderOwner({ stakeholders: [SELF_AS_OWNER] });

      await waitFor(() => {
        expect(queryCy('stakeholder-card')).toBeInTheDocument();
      });
      expect(queryCy('stakeholder-name')).toHaveTextContent(SELF_NAME);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });
});
