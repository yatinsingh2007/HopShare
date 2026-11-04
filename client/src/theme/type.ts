import type { TextStyle } from 'react-native';

export const fonts = {
  display: 'SchibstedGrotesk_800ExtraBold',
  displayBold: 'SchibstedGrotesk_700Bold',
};

// Material 3 type roles. Sizes are sp (React Native scales them with the system font setting).
export const type = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.9 },
  headline: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33, letterSpacing: -0.6 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.1 },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.3 },
  figure: { fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
