import SchemaForm from '@components/json/schema/schema-form.component';
import { jsonWidgets } from '@components/json/widgets';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

type FormUiSchema = UiSchema<Record<string, unknown>>;
const SCHEMA_ID = 'widget-registry-schema:1';

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    finansiering: {
      type: 'array',
      uniqueItems: true,
      title: 'Finansiering',
      items: {
        type: 'string',
        oneOf: [
          { const: 'EGNA_MEDEL', title: 'Egna medel' },
          { const: 'BANKLAN', title: 'Banklån' },
        ],
      },
    },
  },
};

function renderWith(uiSchema: FormUiSchema) {
  return render(<SchemaForm schemaId={SCHEMA_ID} schema={schema} uiSchema={uiSchema} hideSubmitButton />);
}

describe('JSON form widget registry', () => {
  // The same ui schemas are rendered by Draken, so a name that resolves there must resolve here.
  const drakenNames = [
    'TextWidget',
    'SelectWidget',
    'RadiobuttonWidget',
    'CheckboxWidget',
    'CheckboxGroupWidget',
    'DateWidget',
    'TimeWidget',
    'ComboboxWidget',
    'TexteditorWidget',
    'TextareaWidget',
    'RadioWidget',
    'text',
    'select',
    'radio',
    'radiobutton',
    'checkbox',
    'checkboxes',
    'checkboxGroup',
    'checkbox-group',
    'date',
    'time',
    'combobox',
    'texteditor',
    'textarea',
  ];

  it.each(drakenNames)('resolves the widget name %s', (name) => {
    expect(jsonWidgets).toHaveProperty(name);
  });

  it.each(['checkboxes', 'CheckboxGroupWidget', 'checkboxGroup', 'checkbox-group'])(
    'renders a multi-select checkbox group for %s',
    (widget) => {
      renderWith({ finansiering: { 'ui:widget': widget } });

      const group = screen.getByRole('group', { name: 'Finansiering' });
      expect(group.tagName).toBe('FIELDSET');
      expect(within(group).getByText('Finansiering').tagName).toBe('LEGEND');
      expect(document.querySelector(`label[for="${group.id}"]`)).not.toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    }
  );

  it('stores the enum values of the checked options, not their labels', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SchemaForm
        schemaId={SCHEMA_ID}
        schema={schema}
        uiSchema={{ finansiering: { 'ui:widget': 'checkboxes' } }}
        formData={{}}
        onChange={onChange}
        hideSubmitButton
      />
    );

    await user.click(screen.getByRole('checkbox', { name: 'Banklån' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ finansiering: ['BANKLAN'] }), expect.anything());
  });
});
