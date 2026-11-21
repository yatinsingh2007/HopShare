import type { TextStyle } from 'react-native';

// Mukta everywhere: a humanist sans from an Indian foundry, read like station signage.
// On Android a custom font ignores fontWeight (it fakes bold), so each weight is its own file:
// pick the weight with fontFamily, never fontWeight.
export const fonts = {
  regular: 'Mukta_400Regular',
  medium: 'Mukta_500Medium',
  semibold: 'Mukta_600SemiBold',
  bold: 'Mukta_700Bold',
  extrabold: 'Mukta_800ExtraBold',
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
