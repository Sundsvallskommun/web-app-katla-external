'use client';
import type { WidgetProps } from '@rjsf/utils';
import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';

import { getCommonProps, getWidgetOptions } from './types';

const TextEditor = dynamic(() => import('@sk-web-gui/text-editor'), { ssr: false });

interface RjsfTextEditorProps extends WidgetProps {
  defaultClassName: string;
  /** When true the toolbar is off regardless of ui:options. */
  disableToolbar?: boolean;
}

/**
 * The shared Quill editor behind TexteditorWidget and TextareaWidget. Both store HTML markup;
 * neither renders a plain `<textarea>`.
 */
export function RjsfTextEditor(props: RjsfTextEditorProps) {
  const { id, value, disabled, readonly, required, invalid, describedBy, className, onChange, onBlur, onFocus } =
    getCommonProps(props, props.defaultClassName);
  const showToolbar = !props.disableToolbar && getWidgetOptions(props.options).disableToolbar === false;
  const hostRef = useRef<HTMLDivElement>(null);
  const markupValue = typeof value === 'string' ? value : '';
  const isReadonly = disabled || readonly;

  useEffect(() => {
    const host = hostRef.current;
    const fieldLabel = document.getElementById(`${id}__title`);
    if (!host || !(fieldLabel instanceof HTMLLabelElement)) return;

    const focusEditor = (event: MouseEvent) => {
      if (isReadonly) return;
      event.preventDefault();
      host.querySelector<HTMLElement>('.ql-editor')?.focus();
    };

    fieldLabel.addEventListener('click', focusEditor);
    return () => {
      fieldLabel.removeEventListener('click', focusEditor);
    };
  }, [id, isReadonly]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const syncAccessibilityAttributes = () => {
      const editor = host.querySelector<HTMLElement>('.ql-editor');
      if (!editor) return;

      editor.id = id;
      editor.setAttribute('role', 'textbox');
      editor.setAttribute('aria-multiline', 'true');
      editor.setAttribute('aria-describedby', describedBy);
      editor.setAttribute('aria-invalid', String(invalid));
      editor.setAttribute('aria-readonly', String(isReadonly));
      editor.setAttribute('aria-disabled', String(disabled));

      if (required) editor.setAttribute('aria-required', 'true');
      else editor.removeAttribute('aria-required');

      editor.setAttribute('aria-labelledby', `${id}__title`);
      editor.removeAttribute('aria-label');
    };

    syncAccessibilityAttributes();
    const observer = new MutationObserver(syncAccessibilityAttributes);
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [describedBy, disabled, id, invalid, isReadonly, required]);

  return (
    <div ref={hostRef} className="w-full">
      <TextEditor
        name={id}
        className={className}
        disableToolbar={!showToolbar}
        readOnly={isReadonly}
        value={{ markup: markupValue }}
        onSelectionChange={(range, oldRange) => {
          if (range && !oldRange) {
            onFocus();
          }
          if (!range && oldRange) {
            onBlur();
          }
        }}
        onChange={(event) => {
          onChange(event.target.value.markup ?? '');
        }}
      />
    </div>
  );
}
