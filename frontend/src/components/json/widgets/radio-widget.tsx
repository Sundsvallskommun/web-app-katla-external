'use client';
import { optionId, type WidgetProps } from '@rjsf/utils';
import { RadioButton } from '@sk-web-gui/react';

import { getCommonProps, getWidgetOptions } from './types';

const DEFAULT_CLASS = 'w-full';

export function RadiobuttonWidget(props: WidgetProps) {
  const { id, value, disabled, readonly, required, className, onChange, onBlur, onFocus } = getCommonProps(
    props,
    DEFAULT_CLASS
  );
  const { enumOptions = [] } = getWidgetOptions(props.options);

  return (
    // The design system fixes the radio label at one line's height, which makes a wrapping option
    // text overlap the next one. These questions routinely run to several lines.
    <div
      className={`${className} flex flex-wrap gap-12 [&_.sk-form-radio-label]:h-auto [&_.sk-form-radio-label]:items-start [&_.sk-form-radio-label]:min-h-[2.8rem]`}
    >
      {enumOptions.map((option, index) => (
        <RadioButton
          key={String(option.value)}
          id={optionId(id, index)}
          name={id}
          value={String(option.value)}
          checked={value === option.value}
          disabled={disabled || readonly}
          required={required}
          onBlur={onBlur}
          onFocus={onFocus}
          onChange={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </RadioButton>
      ))}
    </div>
  );
}
