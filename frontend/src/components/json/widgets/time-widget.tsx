'use client';
import type { WidgetProps } from '@rjsf/utils';
import { Input } from '@sk-web-gui/react';
import dayjs from 'dayjs';

import { getCommonProps, getWidgetOptions } from './types';

const DEFAULT_CLASS = 'w-full max-w-[40rem]';

/**
 * JSON Schema's `time` format is RFC 3339 `full-time`: HH:mm:ss *and* a time offset. A native time
 * field gives only HH:mm, so padding it to HH:mm:ss is not enough — the API rejects an offsetless
 * value. The offset is the browser's current one (+01:00/+02:00 in Sweden) because these fields are
 * wall-clock times, not instants. Fields without `format: time` keep exactly what the user picked.
 */
function toSchemaValue(value: string, requiresFullTime: boolean): string | undefined {
  if (value === '') return undefined;
  if (!requiresFullTime) return value;

  const [hour, minute, second] = value.split(':');
  const time = dayjs()
    .hour(Number(hour))
    .minute(Number(minute))
    .second(Number(second ?? 0))
    .millisecond(0);
  return time.isValid() ? time.format('HH:mm:ssZ') : value;
}

/**
 * `<input type="time">` only accepts HH:mm[:ss], so a stored full-time would blank the field when a
 * draft is loaded back in. Narrowing it to HH:mm keeps the offset out of the control while leaving
 * the stored value untouched until the user actually changes it.
 */
function toInputValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : '';
}

export function TimeWidget(props: WidgetProps) {
  const { id, value, disabled, readonly, required, invalid, describedBy, className, onChange, onBlur, onFocus } =
    getCommonProps(props, DEFAULT_CLASS);
  const requiresFullTime = props.schema.format === 'time';
  // The schema states the picker's granularity; without it the browser steps in minutes.
  const { step } = getWidgetOptions(props.options);

  return (
    <Input
      id={id}
      className={`${className} min-w-0 max-w-full`}
      type="time"
      step={step}
      value={toInputValue(value)}
      disabled={disabled}
      readOnly={readonly}
      required={required}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      onBlur={onBlur}
      onFocus={onFocus}
      onChange={(e) => {
        onChange(toSchemaValue(e.currentTarget.value, requiresFullTime));
      }}
    />
  );
}
