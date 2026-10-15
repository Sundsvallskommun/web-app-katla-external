import SchemaForm from '@components/json/schema/schema-form.component';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => [key, ...Object.values(options ?? {})].join(' '),
  }),
}));

const SCHEMA_ID = 'array-table-schema:1';

// A dynamic table as the AoT schemas state one: an array of objects, each row a couple of fields.
const schema: RJSFSchema = {
  type: 'object',
  properties: {
    banklan: {
      type: 'array',
      title: 'Banklån',
      items: {
        type: 'object',
        properties: {
          langivare: { type: 'string', title: 'Långivare' },
          beloppKronor: { type: 'string', title: 'Belopp (kronor)' },
        },
      },
    },
  },
};

const uiSchema: UiSchema<Record<string, unknown>> = {
  banklan: {
    'ui:options': { addable: true, orderable: false, addButtonLabel: 'Lägg till' },
    items: {
      'ui:order': ['langivare', 'beloppKronor'],
      langivare: { 'ui:widget': 'TextWidget' },
      beloppKronor: { 'ui:widget': 'TextWidget' },
    },
  },
};

const renderForm = () =>
  render(<SchemaForm schemaId={SCHEMA_ID} schema={schema} uiSchema={uiSchema} hideSubmitButton />);

// data-cy is Playwright's test id attribute; Testing Library keeps its own default.
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-cy="array-item"]'));

describe('Dynamic table rendering', () => {
  it('offers an add button labelled from the ui schema, and starts with no rows', () => {
    renderForm();

    expect(screen.getByRole('group', { name: /Banklån/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lägg till' })).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it('adds a row of fields per click', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Lägg till' }));
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByLabelText(/Långivare/)).toBeInTheDocument();
    expect(within(rows()[0]).getByLabelText(/Belopp \(kronor\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lägg till' }));
    expect(rows()).toHaveLength(2);
  });

  it('removes the row the action belongs to and keeps what the others hold', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Lägg till' }));
    await user.click(screen.getByRole('button', { name: 'Lägg till' }));
    await user.type(within(rows()[1]).getByLabelText(/Långivare/), 'Testbanken');

    await user.click(screen.getByRole('button', { name: 'array.remove 1' }));

    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByLabelText(/Långivare/)).toHaveValue('Testbanken');
  });

  // Rows repeat the same field names, so the position is the only thing that tells them apart.
  it('numbers the rows', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Lägg till' }));
    await user.click(screen.getByRole('button', { name: 'Lägg till' }));

    expect(within(rows()[0]).getByText('array.row 1')).toBeInTheDocument();
    expect(within(rows()[1]).getByText('array.row 2')).toBeInTheDocument();
  });

  it('leaves out the add button when the ui schema says the table is not addable', () => {
    render(
      <SchemaForm
        schemaId={SCHEMA_ID}
        schema={schema}
        uiSchema={{ banklan: { 'ui:options': { addable: false } } }}
        hideSubmitButton
      />
    );

    expect(screen.queryByRole('button', { name: /array.add|Lägg till/ })).not.toBeInTheDocument();
  });
});
