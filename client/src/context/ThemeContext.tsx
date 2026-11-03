import { createContext, useContext } from 'react';
import type { ColorTokens } from '@/theme/tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ThemeContextValue = {
  colors: ColorTokens;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

/** The value is created and provided by the root app/_layout.tsx. */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeContext.Provider (app/_layout.tsx)');
  return ctx;
}
