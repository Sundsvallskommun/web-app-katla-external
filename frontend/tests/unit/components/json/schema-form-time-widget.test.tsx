import { getFormSchemaValidator } from '@components/json/schema/form-schema-validator';
import SchemaForm from '@components/json/schema/schema-form.component';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const TIME_SCHEMA_ID = 'time-widget-schema:1';

function renderTimeField(
  schema: RJSFSchema,
  uiSchema: UiSchema<Record<string, unknown>> = {},
  formData: Record<string, unknown> = {}
) {
  const onChange = vi.fn();
  render(
    <SchemaForm
      schemaId={TIME_SCHEMA_ID}
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      onChange={onChange}
      hideSubmitButton
    />
  );

  return { input: screen.getByLabelText('Tid'), onChange };
}

describe('SchemaForm time widget', () => {
  it('renders a design system time field for format time', () => {
    const { input } = renderTimeField({
      type: 'object',
      properties: {
        discoveredTime: { type: 'string', format: 'time', title: 'Tid' },
      },
    });

    expect(input).toHaveAttribute('type', 'time');
    expect(input).toHaveClass('sk-form-input');
  });

  it('renders the same field when the UI schema picks the widget', () => {
    const { input } = renderTimeField(
      {
        type: 'object',
        properties: {
          discoveredTime: { type: 'string', title: 'Tid' },
        },
      },
      { discoveredTime: { 'ui:widget': 'time' } }
    );

    expect(input).toHaveAttribute('type', 'time');
    expect(input).toHaveClass('sk-form-input');
  });

  it('emits RFC 3339 full-time only when the schema requires the time format', () => {
    const { input: timeFormatInput, onChange: onTimeFormatChange } = renderTimeField({
      type: 'object',
      properties: {
        discoveredTime: { type: 'string', format: 'time', title: 'Tid' },
      },
    });

    // The offset is whatever the machine running this is on, so it is derived rather than hardcoded.
    const expected = dayjs().hour(12).minute(11).second(0).millisecond(0).format('HH:mm:ssZ');
    expect(expected).toMatch(/^12:11:00[+-]\d{2}:\d{2}$/);

    fireEvent.change(timeFormatInput, { target: { value: '12:11' } });
    expect(onTimeFormatChange).toHaveBeenLastCalledWith({ discoveredTime: expected }, expect.anything());
  });

  it('shows a stored full-time as HH:mm instead of blanking the field', () => {
    const { input } = renderTimeField(
      {
        type: 'object',
        properties: {
          discoveredTime: { type: 'string', format: 'time', title: 'Tid' },
        },
      },
      {},
      { discoveredTime: '12:11:00+02:00' }
    );

    expect(input).toHaveValue('12:11');
  });

  it('keeps HH:mm for fields without the time format', () => {
    const { input, onChange } = renderTimeField(
      {
        type: 'object',
        properties: {
          discoveredTime: { type: 'string', title: 'Tid' },
        },
      },
      { discoveredTime: { 'ui:widget': 'time' } }
    );

    fireEvent.change(input, { target: { value: '12:11' } });
    expect(onChange).toHaveBeenLastCalledWith({ discoveredTime: '12:11' }, expect.anything());
  });

  // A published schema declares eventTime and occurredTime as format: "time". AJV's `time` treats
  // the offset as optional, so it is deliberately not the contract being pinned here — the upstream
  // API is stricter and wants full RFC 3339, which is why the widget always emits an offset.
  it('yields a value that validates against format time', () => {
    const schema: RJSFSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        eventTime: { type: 'string', format: 'time', title: 'Tid' },
      },
    };
    const validator = getFormSchemaValidator('time-format-contract:1');

    expect(validator.validateFormData({ eventTime: '17:05:00+02:00' }, schema).errors).toEqual([]);
    expect(validator.validateFormData({ eventTime: '17:05:00Z' }, schema).errors).toEqual([]);
    expect(validator.validateFormData({ eventTime: '17:05' }, schema).errors).not.toEqual([]);
    expect(validator.validateFormData({}, schema).errors).toEqual([]);
  });

  it('clears the value instead of storing an empty string', () => {
    const { input, onChange } = renderTimeField(
      {
        type: 'object',
        properties: {
          discoveredTime: { type: 'string', title: 'Tid' },
        },
      },
      { discoveredTime: { 'ui:widget': 'time' } }
    );

    fireEvent.change(input, { target: { value: '12:11' } });
    fireEvent.change(input, { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith({}, expect.anything());
  });
});
