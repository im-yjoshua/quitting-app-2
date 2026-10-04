/**
 * useTheme — resolves the active monochrome theme from the persisted
 * appearance setting (Light / Dark / System) + the OS color scheme.
 *
 * `appearance === 'system'` (default) follows the device; explicit
 * 'light'/'dark' overrides it. Returns the full Theme (scheme + colors).
 */
import { useColorScheme } from 'react-native';

import { useAppState } from '../state/AppStateContext';
import { dark, light, type ColorScheme, type Theme } from './tokens';

export function useScheme(): ColorScheme {
  const { state } = useAppState();
  const system = useColorScheme();
  const setting = state?.settings.appearance ?? 'system';
  if (setting === 'light' || setting === 'dark') return setting;
  return system === 'light' ? 'light' : 'dark';
}

export function useTheme(): Theme {
  const scheme = useScheme();
  return scheme === 'dark' ? dark : light;
}
