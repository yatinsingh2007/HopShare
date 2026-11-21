import { StyleSheet, View } from 'react-native';
import type { AndroidSymbol } from 'expo-symbols';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/** A signage pictogram: a white symbol on a black square (inverted at night). Decorative; the text beside it carries the meaning. */
export function Pictogram({ name, size = 40, tone = 'plate' }: {
  name: AndroidSymbol;
  size?: number;
  /** plate: black tile. sign: yellow tile. coach: maroon tile. */
  tone?: 'plate' | 'sign' | 'coach';
}) {
  const { colors } = useTheme();
  const bg = tone === 'sign' ? colors.accent : tone === 'coach' ? colors.coach : colors.plate;
  const fg = tone === 'sign' ? colors.accentInk : tone === 'coach' ? colors.coachInk : colors.plateInk;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, borderRadius: size >= 40 ? 6 : 4, backgroundColor: bg }]}
    >
      <Icon name={name} size={Math.round(size * 0.58)} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
