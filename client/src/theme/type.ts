import type { TextStyle } from 'react-native';

// Manrope everywhere: a compact geometric sans with clear figures for times and fares.
// On Android a custom font ignores fontWeight (it fakes bold), so each weight is its own file:
// pick the weight with fontFamily, never fontWeight.
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// Material 3 roles on a 4dp grid. Sizes are sp, so they follow the system font setting.
// "monument" is the one big figure a screen leads with (a leaving time), like a gate number.
export const type = {
  monument: { fontFamily: fonts.extrabold, fontSize: 56, lineHeight: 60, letterSpacing: -1.5 },
  display: { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
  headline: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  meta: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
  figure: { fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
