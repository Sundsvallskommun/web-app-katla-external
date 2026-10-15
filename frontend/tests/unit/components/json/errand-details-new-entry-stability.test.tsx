import { ErrandDetails } from '@components/errand-sections/errand-details.component';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The errand type chooses the form, so the test errand needs a categorization to render one. */
const TEST_LABELS = [
  { classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { classification: 'TYPE', resourceName: 'TEST_SCHEMA' },
];

const { loadFormSchemaForEntryMock, loadFormSchemaMock, translateMock } = vi.hoisted(() => ({
  loadFormSchemaForEntryMock: vi.fn(),
  loadFormSchemaMock: vi.fn(),
  translateMock: vi.fn((key: string) => key),
}));

vi.mock('@components/json/utils/schema-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@components/json/utils/schema-utils')>();
  return {
    ...actual,
    loadFormSchema: loadFormSchemaMock,
    loadFormSchemaForEntry: loadFormSchemaForEntryMock,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translateMock, i18n: { resolvedLanguage: 'sv' } }),
}));

const schema: RJSFSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    locationType: {
      type: 'string',
      title: 'Platstyp',
      oneOf: [
        { const: 'FACILITY', title: 'Verksamhet' },
        { const: 'OTHER', title: 'Annan plats' },
      ],
    },
  },
};

const uiSchema: UiSchema<Record<string, unknown>> = {
  locationType: { 'ui:widget': 'radio' },
};

function FormState() {
  const { control } = useFormContext<ErrandFormDTO>();
  const errandFormData = useWatch({ control, name: 'errandFormData' });
  return <output data-testid="form-state">{JSON.stringify(errandFormData)}</output>;
}

function TestForm() {
  const methods = useForm<ErrandFormDTO>({
    defaultValues: {
      labels: TEST_LABELS,
      errandFormData: [],
    },
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

describe('ErrandDetails new entry schema stability', () => {
  beforeEach(() => {
    useMetadataStore.setState({ metadata: { namespace: 'AOT' } });
    loadFormSchemaMock.mockReset().mockResolvedValue({ schema, uiSchema, schemaId: 'schema-v1' });
    loadFormSchemaForEntryMock.mockReset().mockResolvedValue({ schema, uiSchema, schemaId: 'schema-v1' });
    translateMock.mockClear();
  });

  it('keeps the real radio mounted, checked and focused when the first edit persists the already loaded schema ID', async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    const radio = await screen.findByRole('radio', { name: 'Verksamhet' });
    await user.click(radio);

    await waitFor(() => {
      expect(screen.getByTestId('form-state')).toHaveTextContent(
        JSON.stringify([
          {
            schemaName: 'aot_alcohol_test_schema',
            schemaId: 'schema-v1',
            data: '{"locationType":"FACILITY"}',
          },
        ])
      );
    });

    const radioAfterPersist = screen.getByRole('radio', { name: 'Verksamhet' });
    expect(radioAfterPersist).toBe(radio);
    expect(radioAfterPersist).toBeChecked();
    expect(radioAfterPersist).toHaveFocus();
    expect(loadFormSchemaMock).toHaveBeenCalledTimes(1);
    expect(loadFormSchemaForEntryMock).not.toHaveBeenCalled();
  });
});
