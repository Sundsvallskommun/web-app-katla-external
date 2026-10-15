import { ErrandDetails } from '@components/errand-sections/errand-details.component';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import type { ErrandFormDataItem, ErrandFormDTO } from '@interfaces/errand-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The errand type chooses the schema: this categorization derives `aot_alcohol_test_schema`. */
const TEST_LABELS = [
  { classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { classification: 'TYPE', resourceName: 'TEST_SCHEMA' },
];

const { useFormSchemaMock } = vi.hoisted(() => ({
  useFormSchemaMock: vi.fn(() => ({
    schema: { type: 'object' },
    uiSchema: {},
    schemaId: 'schema-v1',
    loading: false,
    error: null,
  })),
}));

vi.mock('@components/json/utils/schema-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@components/json/utils/schema-utils')>()),
}));

vi.mock('@components/json/hooks/use-form-schema', () => ({
  useFormSchema: useFormSchemaMock,
}));

vi.mock('@components/json/schema/schema-form.component', () => ({
  default: ({
    formData,
    onChange,
  }: {
    formData?: Record<string, unknown>;
    onChange?: (data: Record<string, unknown>) => void;
  }) => (
    <>
      <output data-testid="rendered-json">{JSON.stringify(formData)}</output>
      <button type="button" onClick={() => onChange?.({ location: 'new' })}>
        Update schema form
      </button>
    </>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { schemaName?: string }) =>
      key === 'invalid_form_data' ? `Ogiltig JSON för ${options?.schemaName ?? 'okänt schema'}` : key,
  }),
}));

function FormState() {
  const { control } = useFormContext<ErrandFormDTO>();
  const errandFormData = useWatch({ control, name: 'errandFormData' });
  return <output data-testid="form-state">{JSON.stringify(errandFormData)}</output>;
}

function TestForm({ errandFormData }: { errandFormData: ErrandFormDataItem[] }) {
  const methods = useForm<ErrandFormDTO>({
    defaultValues: { errandFormData, labels: TEST_LABELS },
  });

  return (
    <FormProvider {...methods}>
      <FormValidationProvider>
        <ErrandDetails />
        <FormState />
      </FormValidationProvider>
    </FormProvider>
  );
}

describe('ErrandDetails', () => {
  beforeEach(() => {
    useMetadataStore.setState({ metadata: { namespace: 'AOT' } });
    useFormSchemaMock.mockClear();
  });

  it('reads and updates the matching schema entry when parameters are reordered', async () => {
    const otherEntry: ErrandFormDataItem = {
      schemaName: 'other',
      schemaId: 'other-v1',
      data: '{"untouched":true}',
    };
    const targetEntry: ErrandFormDataItem = {
      schemaName: 'aot_alcohol_test_schema',
      schemaId: 'schema-v1',
      data: '{"location":"old"}',
    };

    render(<TestForm errandFormData={[otherEntry, targetEntry]} />);

    expect(screen.getByTestId('rendered-json')).toHaveTextContent('{"location":"old"}');
    expect(useFormSchemaMock).toHaveBeenCalledWith('aot_alcohol_test_schema', {
      kind: 'persisted',
      schemaId: targetEntry.schemaId,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update schema form' }));

    await waitFor(() => {
      expect(screen.getByTestId('form-state')).toHaveTextContent(
        JSON.stringify([otherEntry, { ...targetEntry, data: '{"location":"new"}' }])
      );
    });
  });

  it('preserves corrupt persisted JSON and blocks editing with an explicit error', () => {
    render(
      <TestForm
        errandFormData={[
          {
            schemaName: 'aot_alcohol_test_schema',
            schemaId: 'schema-v1',
            data: '{invalid-json',
          },
        ]}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Ogiltig JSON för aot_alcohol_test_schema');
    expect(screen.queryByTestId('rendered-json')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update schema form' })).not.toBeInTheDocument();
    expect(screen.getByTestId('form-state')).toHaveTextContent('{invalid-json');
  });
});
