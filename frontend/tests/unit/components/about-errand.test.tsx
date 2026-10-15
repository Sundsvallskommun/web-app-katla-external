import { ErrandContentLock } from '@components/errand-content-lock/errand-content-lock.component';
import { AboutErrandContent } from '@components/errand-sections/about-errand.component';
import { useFormValidation } from '@contexts/form-validation-context';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import { LabelDTO } from '@data-contracts/backend/data-contracts';
import { ErrandFormDTO } from '@interfaces/errand-form';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('src/config/appconfig', () => ({
  appConfig: { features: { disclosureDoneMark: false } },
}));

const label = (id: string, classification: string, overrides: Partial<LabelDTO> = {}): LabelDTO => ({
  id,
  classification,
  displayName: id,
  resourceName: id.toUpperCase(),
  resourcePath: id.toUpperCase(),
  ...overrides,
});

const STADIGVARANDE = label('Stadigvarande', 'SUBTYPE');
const TILLFALLIGT = label('Tillfälligt', 'SUBTYPE');
const SERVERING = label('Serveringstillstånd', 'TYPE', { labels: [TILLFALLIGT, STADIGVARANDE] });
const FOLKOL = label('Folköl', 'TYPE');
const ALKOHOL = label('Alkohol', 'CATEGORY', { labels: [SERVERING, FOLKOL] });
const TOBAK = label('Tobak', 'CATEGORY', { labels: [label('Tobaksförsäljning', 'TYPE')] });
const UTGANGEN = label('Utgången', 'CATEGORY', { deprecated: true, labels: [label('Gammal', 'TYPE')] });

const LabelProbe: React.FC = () => {
  const { watch } = useFormContext<ErrandFormDTO>();
  return <span data-testid="labels">{JSON.stringify(watch('labels'))}</span>;
};

const ShowValidationButton: React.FC = () => {
  const { setShowValidation } = useFormValidation();
  return (
    <button
      type="button"
      data-testid="show-validation"
      onClick={() => {
        setShowValidation(true);
      }}
    >
      validera
    </button>
  );
};

const queryCy = (name: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-cy="${name}"]`);

const getCy = (name: string): HTMLElement => {
  const element = queryCy(name);
  if (!element) throw new Error(`No element with data-cy="${name}"`);
  return element;
};

const currentLabels = (): { classification?: string; id?: string }[] => {
  const rendered = screen.getByTestId('labels').textContent;
  return rendered ? (JSON.parse(rendered) as { classification?: string; id?: string }[]) : [];
};

const labelPath = () => currentLabels().map((l) => `${l.classification ?? ''}:${l.id ?? ''}`);

const renderAbout = (defaultValues: Partial<ErrandFormDTO> = {}) => {
  const TestForm: React.FC = () => {
    const methods = useForm<ErrandFormDTO>({ defaultValues });

    return (
      <FormProvider {...methods}>
        <FormValidationProvider>
          <ErrandContentLock>
            <AboutErrandContent />
          </ErrandContentLock>
          <LabelProbe />
          <ShowValidationButton />
        </FormValidationProvider>
      </FormProvider>
    );
  };

  return render(<TestForm />);
};

/** The option list stays mounted but hidden, so the input has to be opened before clicking one. */
const pickType = (name: string) => {
  fireEvent.click(getCy('errand-type-input'));
  fireEvent.click(within(getCy('errand-type-list')).getByRole('option', { name }));
};

/** Group headings and options both render as labels, in the order the list shows them. */
const typeListText = () =>
  Array.from(getCy('errand-type-list').querySelectorAll('label')).map((entry) => entry.textContent?.trim() ?? '');

const categorySelect = () => getCy('errand-category-select');

describe('AboutErrand categorization', () => {
  beforeEach(() => {
    useMetadataStore.setState({ metadata: { labels: { labelStructure: [TOBAK, ALKOHOL, UTGANGEN] } } });
  });

  it('offers the categories in name order, leaving out deprecated ones', () => {
    renderAbout();

    expect(
      within(categorySelect())
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['errand-information:about.category_placeholder', 'Alkohol', 'Tobak']);
  });

  it('keeps the type unanswerable until a category is chosen', () => {
    renderAbout();

    expect(getCy('errand-type-input')).toBeDisabled();

    fireEvent.change(categorySelect(), { target: { value: ALKOHOL.id } });

    expect(getCy('errand-type-input')).not.toBeDisabled();
  });

  it('files the category on its own while the type is still unanswered', async () => {
    renderAbout();

    fireEvent.change(categorySelect(), { target: { value: ALKOHOL.id } });

    await waitFor(() => {
      expect(labelPath()).toEqual(['CATEGORY:Alkohol']);
    });
  });

  it('groups the subtypes under their type and files all three levels from one pick', async () => {
    renderAbout();
    fireEvent.change(categorySelect(), { target: { value: ALKOHOL.id } });
    fireEvent.click(getCy('errand-type-input'));

    // Leaf options come before the groups; subtypes inside a group are sorted by name.
    expect(typeListText()).toEqual(['Folköl', 'Serveringstillstånd', 'Stadigvarande', 'Tillfälligt']);

    fireEvent.click(within(getCy('errand-type-list')).getByRole('option', { name: 'Stadigvarande' }));

    await waitFor(() => {
      expect(labelPath()).toEqual(['CATEGORY:Alkohol', 'TYPE:Serveringstillstånd', 'SUBTYPE:Stadigvarande']);
    });
  });

  it('files a leaf type as two labels', async () => {
    renderAbout();
    fireEvent.change(categorySelect(), { target: { value: ALKOHOL.id } });

    pickType('Folköl');

    await waitFor(() => {
      expect(labelPath()).toEqual(['CATEGORY:Alkohol', 'TYPE:Folköl']);
    });
  });

  it('drops the type when the category changes, since it named a subtree that is gone', async () => {
    renderAbout();
    fireEvent.change(categorySelect(), { target: { value: ALKOHOL.id } });
    pickType('Folköl');
    await waitFor(() => {
      expect(labelPath()).toHaveLength(2);
    });

    fireEvent.change(categorySelect(), { target: { value: TOBAK.id } });

    await waitFor(() => {
      expect(labelPath()).toEqual(['CATEGORY:Tobak']);
    });
  });

  it('shows the classification an errand was loaded with', () => {
    renderAbout({
      labels: [
        { id: 'Alkohol', classification: 'CATEGORY' },
        { id: 'Serveringstillstånd', classification: 'TYPE' },
        { id: 'Stadigvarande', classification: 'SUBTYPE' },
      ],
    });

    expect(categorySelect()).toHaveValue('Alkohol');
    expect(getCy('errand-type-input')).toHaveValue('Stadigvarande');
  });

  it('says what is missing only once validation has been asked for', async () => {
    renderAbout();

    expect(queryCy('errand-category-error')).toBeNull();

    fireEvent.click(screen.getByTestId('show-validation'));

    await waitFor(() => {
      expect(queryCy('errand-category-error')).toHaveTextContent('validation:categorization.category_required');
    });
    expect(queryCy('errand-type-error')).toBeNull();

    fireEvent.change(categorySelect(), { target: { value: ALKOHOL.id } });

    await waitFor(() => {
      expect(queryCy('errand-type-error')).toHaveTextContent('validation:categorization.type_required');
    });
    expect(queryCy('errand-category-error')).toBeNull();
  });

  it('renders a submitted errand as text, with no controls to change it', () => {
    renderAbout({
      id: 'id-1',
      status: 'NEW',
      labels: [
        { id: 'Alkohol', classification: 'CATEGORY', displayName: 'Alkohol' },
        { id: 'Serveringstillstånd', classification: 'TYPE', displayName: 'Serveringstillstånd' },
        { id: 'Stadigvarande', classification: 'SUBTYPE', displayName: 'Stadigvarande' },
      ],
    });

    expect(getCy('errand-categorization-summary')).toHaveTextContent('Alkohol');
    expect(getCy('errand-categorization-summary')).toHaveTextContent('Stadigvarande');
    expect(queryCy('errand-category-select')).toBeNull();
    expect(queryCy('errand-type-input')).toBeNull();
  });
});
