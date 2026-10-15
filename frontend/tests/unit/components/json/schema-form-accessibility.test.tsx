import SchemaForm from '@components/json/schema/schema-form.component';
import { descriptionId, errorId, type RJSFSchema, titleId, type UiSchema } from '@rjsf/utils';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { useMetadataStore } from 'src/stores/metadata-store';
import { afterEach, describe, expect, it, vi } from 'vitest';

type FormUiSchema = UiSchema<Record<string, unknown>>;
const ACCESSIBILITY_TEST_SCHEMA_ID = 'accessibility-test-schema:1';

interface TextEditorStubProps {
  className?: string;
  name?: string;
  readOnly?: boolean;
}

vi.mock('next/dynamic', () => ({
  default: () => {
    const TextEditorStub: ComponentType<TextEditorStubProps> = ({ className, name, readOnly }) => (
      <div className={className} data-name={name}>
        <div className="ql-editor" contentEditable={!readOnly} />
      </div>
    );

    return TextEditorStub;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      if (key === 'field_description.new_tab_announcement') return 'Öppnas i en ny flik';
      return typeof fallback === 'string' ? fallback : key;
    },
  }),
}));

vi.mock('@services/employee-service/employee-service', () => ({
  getUserEmployments: vi.fn().mockResolvedValue([]),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  useMetadataStore.setState({ metadata: undefined });
});

describe('SchemaForm accessibility contract', () => {
  it('sanitizes external descriptions and connects label, description, required state and errors', async () => {
    const schema: RJSFSchema = {
      type: 'object',
      required: ['summary'],
      properties: {
        summary: {
          type: 'string',
          title: 'Sammanfattning',
          minLength: 3,
          description: '<p>Schema description</p>',
        },
        details: {
          type: 'string',
          title: 'Detaljer',
          description: '<p>Trygg schematext</p><img src="x" onerror="alert(4)"><script>alert(5)</script>',
        },
      },
    };
    const uiSchema: FormUiSchema = {
      summary: {
        'ui:description':
          '<p>Trygg <strong>beskrivning</strong></p><img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">farlig länk</a><a href="https://example.com" target="_blank">trygg länk</a><a href="https://example.com/report" target="report">namngiven länk</a><a href="https://example.com/uppercase" target="_BLANK">versal länk</a>',
      },
    };

    render(
      <SchemaForm
        schemaId={ACCESSIBILITY_TEST_SCHEMA_ID}
        schema={schema}
        uiSchema={uiSchema}
        hideSubmitButton
        showValidation
      />
    );

    const input = screen.getByRole('textbox', { name: 'Sammanfattning' });
    const fieldId = input.id;
    const label = document.getElementById(titleId(fieldId));
    const description = document.getElementById(descriptionId(fieldId));

    expect(label).toHaveAttribute('for', fieldId);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining(descriptionId(fieldId)));
    expect(description).toHaveTextContent('Trygg beskrivning');
    expect(description).toHaveTextContent('farlig länk');
    expect(description?.innerHTML).toContain('<strong>beskrivning</strong>');
    expect(description?.innerHTML).not.toMatch(/<script|onerror|javascript:/i);
    const externalLink = screen.getByRole('link', { name: 'trygg länk' });
    expect(externalLink).toHaveTextContent('trygg länk');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(externalLink).toHaveAccessibleDescription('Öppnas i en ny flik');

    const namedTargetLink = screen.getByRole('link', { name: 'namngiven länk' });
    expect(namedTargetLink).not.toHaveAttribute('target');
    expect(namedTargetLink).not.toHaveAttribute('rel');
    expect(namedTargetLink).not.toHaveAccessibleDescription();

    const differentlyCasedTargetLink = screen.getByRole('link', { name: 'versal länk' });
    expect(differentlyCasedTargetLink).not.toHaveAttribute('target');
    expect(differentlyCasedTargetLink).not.toHaveAttribute('rel');
    expect(differentlyCasedTargetLink).not.toHaveAccessibleDescription();

    const detailsInput = screen.getByRole('textbox', { name: 'Detaljer' });
    const schemaDescription = document.getElementById(descriptionId(detailsInput.id));
    expect(schemaDescription).toHaveTextContent('Trygg schematext');
    expect(schemaDescription?.innerHTML).not.toMatch(/script|onerror/i);

    fireEvent.change(input, { target: { value: 'x' } });

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(errorId(fieldId))).toBeInTheDocument();
    });
  });

  // A grouped question carries its description as ui schema markup. RJSF hands that markup to the
  // object template as a plain string, where it would render as escaped text next to the real one.
  it('renders a grouped question description once, as markup', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        personnummer: {
          type: 'object',
          title: 'Personnummer',
          properties: { personnummer: { type: 'string', title: 'Personnummer' } },
        },
      },
    };
    const uiSchema: FormUiSchema = {
      personnummer: {
        'ui:options': { showObjectFieldset: true },
        'ui:description': '<p>Ange personnummer</p>',
        personnummer: { 'ui:widget': 'TextWidget' },
      },
    };

    render(<SchemaForm schemaId={ACCESSIBILITY_TEST_SCHEMA_ID} schema={schema} uiSchema={uiSchema} hideSubmitButton />);

    const description = document.getElementById(descriptionId('root_personnummer'));
    expect(description).toHaveTextContent('Ange personnummer');
    expect(description?.querySelector('p')).toBeInTheDocument();
    expect(screen.queryByText('<p>Ange personnummer</p>')).not.toBeInTheDocument();
  });

  it('gives a radio group a real accessible name, shared native group name and clickable option labels', async () => {
    const user = userEvent.setup();
    const schema: RJSFSchema = {
      type: 'object',
      required: ['eventType'],
      properties: {
        eventType: {
          type: 'string',
          title: 'Händelsetyp',
          description: 'Välj den typ som bäst beskriver händelsen.',
          enum: ['DEVIATION', 'MISCONDUCT'],
        },
      },
    };
    const uiSchema: FormUiSchema = {
      eventType: {
        'ui:widget': 'radio',
        'ui:enumNames': ['Avvikelse', 'Missförhållande'],
      },
    };

    render(<SchemaForm schemaId={ACCESSIBILITY_TEST_SCHEMA_ID} schema={schema} uiSchema={uiSchema} hideSubmitButton />);

    const group = screen.getByRole('group', { name: 'Händelsetyp' });
    const radios = screen.getAllByRole('radio');

    expect(group.tagName).toBe('FIELDSET');
    expect(within(group).getByText('Händelsetyp').tagName).toBe('LEGEND');
    expect(document.querySelector(`label[for="${group.id}"]`)).not.toBeInTheDocument();
    expect(group).toHaveAttribute('aria-describedby', expect.stringContaining(descriptionId(group.id)));
    expect(radios).toHaveLength(2);
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute('name', group.id);
      expect(radio).toBeRequired();
    });

    await user.click(screen.getByText('Missförhållande'));
    const selectedRadio = screen.getByRole('radio', { name: 'Missförhållande' });
    expect(selectedRadio).toBeChecked();
    expect(selectedRadio).toHaveFocus();
  });

  it('sanitizes field descriptions during server rendering without a browser DOM', () => {
    vi.stubGlobal('DOMParser', undefined);
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          title: 'Sammanfattning',
          description: '<p>Servertext</p><a href="https://example.com" target="_blank">Dokumentation</a>',
        },
      },
    };

    expect(() =>
      renderToString(<SchemaForm schemaId={ACCESSIBILITY_TEST_SCHEMA_ID} schema={schema} hideSubmitButton />)
    ).not.toThrow();
  });

  it('keeps hidden labels as operable accessible names for native and rich text widgets', async () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string', title: 'Dold sammanfattning' },
        notes: { type: 'string', title: 'Dold anteckning' },
      },
    };
    const uiSchema: FormUiSchema = {
      summary: { 'ui:options': { hideLabel: true } },
      notes: { 'ui:widget': 'texteditor', 'ui:options': { hideLabel: true } },
    };

    render(<SchemaForm schemaId={ACCESSIBILITY_TEST_SCHEMA_ID} schema={schema} uiSchema={uiSchema} hideSubmitButton />);

    const summary = screen.getByRole('textbox', { name: 'Dold sammanfattning' });
    const summaryLabel = document.querySelector<HTMLLabelElement>(`label[for="${summary.id}"]`);
    expect(summaryLabel).toHaveClass('sr-only');

    await waitFor(() => {
      const editor = screen.getByRole('textbox', { name: 'Dold anteckning' });
      expect(editor).toHaveAttribute('aria-labelledby', `${editor.id}__title`);
      expect(document.getElementById(`${editor.id}__title`)).toHaveClass('sr-only');
    });
  });

  it('lets the visible field label activate and focus the Quill editing surface', async () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        notes: { type: 'string', title: 'Anteckning' },
      },
    };
    const uiSchema: FormUiSchema = {
      notes: { 'ui:widget': 'texteditor' },
    };

    render(<SchemaForm schemaId={ACCESSIBILITY_TEST_SCHEMA_ID} schema={schema} uiSchema={uiSchema} hideSubmitButton />);

    const editor = await screen.findByRole('textbox', { name: 'Anteckning' });
    const label = document.querySelector<HTMLLabelElement>(`label[for="${editor.id}"]`);
    expect(label).toBeInTheDocument();
    label?.click();
    expect(editor).toHaveFocus();
  });

  it('prevents interaction in disabled and readonly checkbox, select and rich text widgets', async () => {
    const editableSchema: RJSFSchema = {
      type: 'object',
      properties: {
        consent: { type: 'boolean', title: 'Samtycke' },
        choice: { type: 'string', title: 'Val', enum: ['A', 'B'] },
        notes: { type: 'string', title: 'Anteckning' },
      },
    };
    const uiSchema: FormUiSchema = {
      choice: { 'ui:widget': 'select' },
      notes: { 'ui:widget': 'texteditor' },
    };

    const { unmount } = render(
      <SchemaForm
        schemaId={ACCESSIBILITY_TEST_SCHEMA_ID}
        schema={editableSchema}
        uiSchema={uiSchema}
        hideSubmitButton
        disabled
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Samtycke' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Val' })).toBeDisabled();
    await waitFor(() => {
      const editor = screen.getByRole('textbox', { name: 'Anteckning' });
      expect(editor).toHaveAttribute('aria-disabled', 'true');
      expect(editor).toHaveAttribute('aria-readonly', 'true');
    });

    unmount();

    const readonlySchema: RJSFSchema = {
      ...editableSchema,
      properties: {
        consent: { type: 'boolean', title: 'Samtycke', readOnly: true },
        choice: { type: 'string', title: 'Val', enum: ['A', 'B'], readOnly: true },
        notes: { type: 'string', title: 'Anteckning', readOnly: true },
      },
    };

    render(
      <SchemaForm
        schemaId={ACCESSIBILITY_TEST_SCHEMA_ID}
        schema={readonlySchema}
        uiSchema={uiSchema}
        hideSubmitButton
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Samtycke' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Val' })).toBeDisabled();
    await waitFor(() => {
      const editor = screen.getByRole('textbox', { name: 'Anteckning' });
      expect(editor).toHaveAttribute('aria-disabled', 'false');
      expect(editor).toHaveAttribute('aria-readonly', 'true');
    });
  });
});
