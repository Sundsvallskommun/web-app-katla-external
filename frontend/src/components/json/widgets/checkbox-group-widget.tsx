'use client';
import type { WidgetProps } from '@rjsf/utils';
import { Checkbox } from '@sk-web-gui/react';

import { getCommonProps, getWidgetOptions } from './types';

const DEFAULT_CLASS = 'w-full max-w-[48rem]';

const contains = (values: readonly unknown[], expected: unknown): boolean =>
  values.some((value) => Object.is(value, expected));

/**
 * Multi-select checkboxes for `type: "array"` with an enum. The surrounding fieldset and legend
 * come from FieldTemplate, so this renders only the group itself.
 */
export function CheckboxGroupWidget(props: WidgetProps) {
  const { id, value, disabled, readonly, className, onChange, onBlur, onFocus } = getCommonProps(props, DEFAULT_CLASS);
  const { enumOptions = [], enumDisabled = [], direction } = getWidgetOptions(props.options);

  const selected: readonly unknown[] = Array.isArray(value) ? value : [];
  // Checkbox.Group addresses options by string key, so the index is the key and the enum value
  // is only ever mapped back on change.
  const selectedKeys = enumOptions.flatMap((option, index) =>
    contains(selected, option.value) ? [String(index)] : []
  );
  const atMaximum = typeof props.schema.maxItems === 'number' && selected.length >= props.schema.maxItems;

  return (
    <div className={`${className} min-w-0 max-w-full`}>
      <Checkbox.Group
        name={id}
        value={selectedKeys}
        direction={direction ?? 'column'}
        onChange={(keys: (string | number | readonly string[] | undefined)[]) => {
          const picked = new Set(keys.map(String));
          onChange(enumOptions.filter((_, index) => picked.has(String(index))).map((option) => option.value));
        }}
      >
        {enumOptions.map((option, index) => (
          <Checkbox
            key={`${id}-${index}`}
            id={`${id}-${index}`}
            value={String(index)}
            disabled={
              disabled ||
              readonly ||
              contains(enumDisabled, option.value) ||
              (atMaximum && !contains(selected, option.value))
            }
            onBlur={onBlur}
            onFocus={onFocus}
          >
            {option.label}
          </Checkbox>
        ))}
      </Checkbox.Group>
    </div>
  );
}
