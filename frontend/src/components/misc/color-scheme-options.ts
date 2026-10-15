import { ColorSchemeMode } from '@sk-web-gui/react';
import { Monitor, Moon, Sun } from 'lucide-react';

/**
 * The colour schemes in display order. Owned in one place so the user menu and the mobile menu
 * can never drift apart in values, labels or icons.
 */
export const colorSchemeOptions = [
  { value: ColorSchemeMode.Light, labelKey: 'layout:color_scheme.light', icon: Sun },
  { value: ColorSchemeMode.Dark, labelKey: 'layout:color_scheme.dark', icon: Moon },
  { value: ColorSchemeMode.System, labelKey: 'layout:color_scheme.system', icon: Monitor },
] as const;
