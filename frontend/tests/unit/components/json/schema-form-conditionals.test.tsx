import SchemaForm from '@components/json/schema/schema-form.component';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SCHEMA_ID = 'conditionals-schema:1';

/** The shape the OpenE rules flatten into: a checkbox source revealing two dependent fields. */
const schema: RJSFSchema = {
  type: 'object',
  properties: {
    finansiering: {
      type: 'array',
      uniqueItems: true,
      title: 'Finansiering',
      items: { type: 'string', oneOf: [{ const: 'EGNA_MEDEL', title: 'Egna medel' }] },
    },
    egnaMedel: { type: 'string', title: 'Egna medel, belopp' },
    ovrigt: { type: 'string', title: 'Övrigt' },
  },
  allOf: [
    {
      if: { properties: { finansiering: { contains: { const: 'EGNA_MEDEL' } } }, required: ['finansiering'] },
      then: { required: ['egnaMedel'] },
    },
  ],
};

const uiSchema: UiSchema<Record<string, unknown>> = {
  finansiering: { 'ui:widget': 'checkboxes' },
  egnaMedel: { 'ui:widget': 'TextWidget' },
  ovrigt: { 'ui:widget': 'TextWidget' },
};

/** Mirrors how the errand form drives SchemaForm: controlled data, updated from onChange. */
function ControlledForm({ onData }: { onData: (data: Record<string, unknown>) => void }) {
  const [data, setData] = useState<Record<string, unknown>>({ ovrigt: 'kvar' });

  return (
    <SchemaForm
      schemaId={SCHEMA_ID}
      schema={schema}
      uiSchema={uiSchema}
      formData={data}
      onChange={(next) => {
        setData(next);
        onData(next);
      }}
      hideSubmitButton
    />
  );
}

describe('SchemaForm conditional fields', () => {
  it('hides a dependent field until its condition is met, and clears its answer when it is not', async () => {
    const user = userEvent.setup();
    const onData = vi.fn();
    render(<ControlledForm onData={onData} />);

    // Unconditional fields render from the start; the dependent one does not.
    expect(screen.getByRole('textbox', { name: 'Övrigt' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Egna medel, belopp' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Egna medel' }));
    await screen.findByRole('textbox', { name: 'Egna medel, belopp' });

    // Re-queried rather than reused: each change re-renders the form and replaces the input node.
    await user.type(screen.getByRole('textbox', { name: 'Egna medel, belopp' }), '10000');
    expect(onData).toHaveBeenLastCalledWith(
      expect.objectContaining({ finansiering: ['EGNA_MEDEL'], egnaMedel: '10000' })
    );

    // Unticking hides the field again and drops what was typed into it.
    await user.click(screen.getByRole('checkbox', { name: 'Egna medel' }));

    expect(screen.queryByRole('textbox', { name: 'Egna medel, belopp' })).not.toBeInTheDocument();
    const [lastData] = onData.mock.lastCall as [Record<string, unknown>];
    expect(lastData).not.toHaveProperty('egnaMedel');
    expect(lastData.ovrigt).toBe('kvar');
  });

  /**
   * The schemas state a choice as a `oneOf` of consts. RJSF defaults such a field to the first
   * const unless told otherwise, which would file an answer the citizen never gave — and reveal
   * whatever that answer conditions.
   */
  it('leaves a choice unanswered until the citizen answers it', () => {
    const choiceSchema: RJSFSchema = {
      type: 'object',
      properties: {
        foretagsform: {
          type: 'string',
          title: 'Företagsform',
          oneOf: [
            { const: 'AKTIEBOLAG', title: 'Aktiebolag' },
            { const: 'HANDELSBOLAG', title: 'Handelsbolag' },
          ],
        },
        organisationsnummer: { type: 'string', title: 'Organisationsnummer' },
      },
      allOf: [
        {
          if: { properties: { foretagsform: { const: 'AKTIEBOLAG' } }, required: ['foretagsform'] },
          then: { required: ['organisationsnummer'] },
        },
      ],
    };

    render(
      <SchemaForm
        schemaId={SCHEMA_ID}
        schema={choiceSchema}
        uiSchema={{
          foretagsform: { 'ui:widget': 'RadiobuttonWidget' },
          organisationsnummer: { 'ui:widget': 'TextWidget' },
        }}
        hideSubmitButton
      />
    );

    expect(screen.getByRole('radio', { name: 'Aktiebolag' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Handelsbolag' })).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Organisationsnummer' })).not.toBeInTheDocument();
  });
});
