import { ErrandAttachments } from '@components/errand-sections/errand-attachments.component';
import { useFormValidation } from '@contexts/form-validation-context';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import type { ErrandFormDTO } from '@interfaces/errand-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { useMetadataStore } from 'src/stores/metadata-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const LABELS = [
  { classification: 'CATEGORY', resourceName: 'ALCOHOL' },
  { classification: 'TYPE', resourceName: 'TEST_SCHEMA' },
];
const SCHEMA_NAME = 'aot_alcohol_test_schema';

const SCHEMA = {
  type: 'object',
  properties: {},
  'x-attachments': [
    {
      key: 'POWER_OF_ATTORNEY',
      label: 'Fullmakt',
      requiredWhen: { properties: { arDuFirmatecknare: { const: 'NEJ' } }, required: ['arDuFirmatecknare'] },
    },
  ],
};

const { useFormSchemaMock } = vi.hoisted(() => ({ useFormSchemaMock: vi.fn() }));

vi.mock('@components/json/hooks/use-form-schema', () => ({ useFormSchema: useFormSchemaMock }));

vi.mock('@services/errand-service/attachment-service', () => ({
  ALLOWED_ATTACHMENT_MIME_TYPES: [],
  MAX_ATTACHMENT_SIZE_MB: 10,
  getErrandAttachments: vi.fn(() => Promise.resolve([])),
  deleteErrandAttachment: vi.fn(),
  downloadErrandAttachment: vi.fn(),
  updateErrandAttachmentCategory: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('src/config/appconfig', () => ({
  appConfig: { features: { disclosureDoneMark: false } },
}));

const ShowValidation: React.FC = () => {
  const { setShowValidation } = useFormValidation();
  return (
    <button
      type="button"
      onClick={() => {
        setShowValidation(true);
      }}
    >
      validate
    </button>
  );
};

const renderAttachments = (defaultValues: Partial<ErrandFormDTO>) => {
  const TestForm: React.FC = () => {
    const methods = useForm<ErrandFormDTO>({ defaultValues: { labels: LABELS, ...defaultValues } });
    return (
      <FormProvider {...methods}>
        <FormValidationProvider>
          <ErrandAttachments />
          <ShowValidation />
        </FormValidationProvider>
      </FormProvider>
    );
  };
  return render(<TestForm />);
};

const answers = (data: Record<string, unknown>): Partial<ErrandFormDTO> => ({
  errandFormData: [{ schemaName: SCHEMA_NAME, data: JSON.stringify(data) }],
});

const statusLabel = () => document.querySelector('[data-cy="section-status-attachments"]');

const validate = () => {
  fireEvent.click(screen.getByRole('button', { name: 'validate' }));
};

describe('attachments section status', () => {
  beforeEach(() => {
    useMetadataStore.setState({ metadata: { namespace: 'AOT' } });
    useFormSchemaMock.mockReturnValue({ schema: SCHEMA, loading: false, error: null, notFound: false });
  });

  it('shows no status before validation runs', () => {
    renderAttachments(answers({ arDuFirmatecknare: 'NEJ' }));

    expect(statusLabel()).toBeNull();
  });

  it('is incomplete when a required attachment is missing', async () => {
    renderAttachments(answers({ arDuFirmatecknare: 'NEJ' }));
    validate();

    await waitFor(() => {
      expect(statusLabel()?.textContent).toBe('section_incomplete');
    });
  });

  // Which files satisfy a requirement is covered in errand-attachments.test.ts; rendering one here
  // would pull in the file list, which needs a real browser.
  it('is complete when no attachment is missing', async () => {
    renderAttachments(answers({ arDuFirmatecknare: 'JA' }));
    validate();

    await waitFor(() => {
      expect(statusLabel()?.textContent).toBe('section_complete');
    });
  });

  it('is incomplete when the schema cannot be read, since the requirement is unknown', async () => {
    useFormSchemaMock.mockReturnValue({ schema: null, loading: false, error: 'boom', notFound: false });
    renderAttachments({});
    validate();

    await waitFor(() => {
      expect(statusLabel()?.textContent).toBe('section_incomplete');
    });
  });
});
