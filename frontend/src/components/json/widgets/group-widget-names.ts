/**
 * The widget registry names that render a grouped control. FieldTemplate needs to know which
 * fields are groups so it can give them fieldset/legend rather than a label pointing at a single
 * id, and the registry is the only truth about which names lead there. Add new aliases here and
 * in the registry.
 */
export const RADIO_WIDGET_NAMES = ['RadiobuttonWidget', 'RadioWidget', 'radio', 'radiobutton'] as const;

export const CHECKBOX_GROUP_WIDGET_NAMES = [
  'CheckboxGroupWidget',
  'checkboxes',
  'checkboxGroup',
  'checkbox-group',
] as const;

const GROUP_WIDGET_NAMES: readonly string[] = [...RADIO_WIDGET_NAMES, ...CHECKBOX_GROUP_WIDGET_NAMES];

export const isGroupWidgetName = (widget: unknown): boolean =>
  typeof widget === 'string' && GROUP_WIDGET_NAMES.includes(widget);
