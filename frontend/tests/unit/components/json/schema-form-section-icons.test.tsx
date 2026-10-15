import SchemaForm from '@components/json/schema/schema-form.component';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      title: 'Beskrivning',
    },
  },
};

function uiSchemaWithIcon(icon: string): UiSchema<Record<string, unknown>> {
  return {
    'ui:sections': [
      {
        id: 'event-information',
        title: 'Information om händelsen',
        icon,
        fields: ['description'],
        defaultOpen: true,
      },
    ],
  };
}

function SectionIconForm({ icon, schemaId }: { icon: string; schemaId: string }) {
  const methods = useForm();

  return (
    <FormProvider {...methods}>
      <SchemaForm schemaId={schemaId} schema={schema} uiSchema={uiSchemaWithIcon(icon)} hideSubmitButton />
    </FormProvider>
  );
}

describe('SchemaForm section icons', () => {
  it('renders a Lucide section icon from the UI schema kebab-case name', () => {
    const { container } = render(<SectionIconForm schemaId="section-icon-schema:1" icon="file-text" />);

    expect(screen.getByText('Information om händelsen')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-file-text')).toBeInTheDocument();
  });

  it('keeps the section usable when the UI schema contains an unknown icon name', () => {
    const { container } = render(
      <SectionIconForm schemaId="unknown-section-icon-schema:1" icon="icon-that-does-not-exist" />
    );

    expect(screen.getByText('Information om händelsen')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-icon-that-does-not-exist')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Beskrivning' })).toBeInTheDocument();
  });
});
