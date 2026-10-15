import { ErrandDetails } from '@components/errand-sections/errand-details.component';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The errand type chooses the form, so the test errand needs a categorization to render one. */
const TEST_LABELS = [
  { classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { classification: 'TYPE', resourceName: 'TEST_SCHEMA' },
];

const { loadFormSchemaForEntryMock, translateMock } = vi.hoisted(() => ({
  loadFormSchemaForEntryMock: vi.fn(),
  translateMock: vi.fn((key: string) => key),
}));

vi.mock('@components/json/utils/schema-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@components/json/utils/schema-utils')>();
  return {
    ...actual,
    loadFormSchemaForEntry: loadFormSchemaForEntryMock,
  };
});

vi.mock('@components/json/schema/schema-form.component', () => ({
  default: ({
    formData,
    onChange,
  }: {
    formData?: Record<string, unknown>;
    onChange?: (data: Record<string, unknown>) => void;
  }) => (
    <input
      aria-label="Plats"
      value={typeof formData?.location === 'string' ? formData.location : ''}
      onChange={(event) => {
        onChange?.({ location: event.currentTarget.value });
      }}
    />
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translateMock, i18n: { resolvedLanguage: 'sv' } }),
}));

function TestForm() {
  const methods = useForm<ErrandFormDTO>({
    defaultValues: {
      labels: TEST_LABELS,
      errandFormData: [
        {
          schemaName: 'aot_alcohol_test_schema',
          schemaId: 'schema-v1',
          data: '{"location":""}',
        },
      ],
    },
  });

  return (
    <FormProvider {...methods}>
      <FormValidationProvider>
        <ErrandDetails />
      </FormValidationProvider>
    </FormProvider>
  );
}

describe('ErrandDetails schema stability', () => {
  beforeEach(() => {
    useMetadataStore.setState({ metadata: { namespace: 'AOT' } });
    loadFormSchemaForEntryMock.mockReset().mockResolvedValue({
      schema: { type: 'object' },
      uiSchema: {},
      schemaId: 'schema-v1',
    });
    translateMock.mockClear();
  });

  it('keeps focus and loads the persisted schema only once while entering multiple characters', async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    const input = await screen.findByRole('textbox', { name: 'Plats' });
    await user.click(input);
    await user.type(input, 'ABC');

    expect(input).toHaveValue('ABC');
    expect(input).toHaveFocus();
    expect(loadFormSchemaForEntryMock).toHaveBeenCalledTimes(1);
    expect(loadFormSchemaForEntryMock).toHaveBeenCalledWith(
      'aot_alcohol_test_schema',
      'schema-v1',
      translateMock,
      'sv'
    );
  });
});
