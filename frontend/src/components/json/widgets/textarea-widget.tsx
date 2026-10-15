'use client';
import type { WidgetProps } from '@rjsf/utils';

import { RjsfTextEditor } from './rjsf-text-editor';

export function TextareaWidget(props: WidgetProps) {
  return <RjsfTextEditor {...props} defaultClassName="w-full max-w-[40rem] h-[10rem]" disableToolbar />;
}
