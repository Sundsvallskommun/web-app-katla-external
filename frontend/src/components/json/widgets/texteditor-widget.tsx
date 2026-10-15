'use client';
import type { WidgetProps } from '@rjsf/utils';

import { RjsfTextEditor } from './rjsf-text-editor';

export function TexteditorWidget(props: WidgetProps) {
  return <RjsfTextEditor {...props} defaultClassName="w-full h-[22rem]" />;
}
