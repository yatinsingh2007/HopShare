import type { DimensionValue } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { Skeleton } from 'moti/skeleton';
import { useTheme } from '@/context/ThemeContext';

// the shimmer's light band, a step lighter than the card in dark mode and a step lighter than the line in light mode
const SHINE = { light: '#F4F4F0', dark: '#3A3A36' };

/** One shimmering block in the app's colours (Moti's Skeleton). Still, not shimmering, under Reduce motion. */
export function Bone({ width = '100%', height = 16, radius = 6 }: {
  width?: DimensionValue;
  height?: number;
  radius?: number | 'round';
}) {
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const base = colors.line;
  return (
    <Skeleton
      show
      width={width}
      height={height}
      radius={radius}
      colorMode={scheme}
      backgroundColor={base}
      colors={reduced ? [base, base] : [base, SHINE[scheme], base, base]}
    />
  );
}

/** A card-shaped wrapper that fades in, and is announced once as "Loading". */
export function SkeletonCard({ children, index = 0, style }: {
  children: React.ReactNode;
  index?: number;
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(200)}
      exiting={FadeOut.duration(150)}
      accessible={index === 0}
      accessibilityLabel="Loading"
      importantForAccessibility={index === 0 ? 'yes' : 'no-hide-descendants'}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** Same shape as RideCard and the matched group card: code tile, time, route line, seats. */
export function RideCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <SkeletonCard index={index} style={styles.row}>
      <Bone width={64} height={64} radius={6} />
      <View style={styles.lines}>
        <Bone width="40%" height={28} />
        <Bone width="78%" height={14} />
        <Bone width="52%" height={14} />
      </View>
    </SkeletonCard>
  );
}

/** A place in a list: icon tile and two lines. */
export function PlaceRowSkeleton({ index = 0 }: { index?: number }) {
  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(200)}
      accessible={index === 0}
      accessibilityLabel="Loading"
      importantForAccessibility={index === 0 ? 'yes' : 'no-hide-descendants'}
      style={[styles.row, styles.place]}
    >
      <Bone width={40} height={40} radius={6} />
      <View style={styles.lines}>
        <Bone width="60%" height={14} />
        <Bone width="35%" height={12} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 12, padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lines: { flex: 1, gap: 8 },
  place: { minHeight: 56, paddingVertical: 8 },
});
