import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import type { AndroidSymbol } from 'expo-symbols';
import { Icon } from '@/components/Icon';
import { Pictogram } from '@/components/Pictogram';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

/**
 * The app's one sign: a yellow band that names the next decision and how far it is,
 * the way a station sign names the platform and the walk. One per screen.
 * When the message changes it rolls over like a sign being updated.
 */
export function SignBand({ icon, title, detail, onPress, accessibilityLabel }: {
  icon: AndroidSymbol;
  title: string;
  detail?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const enter = reduced ? FadeIn.duration(150) : FadeInDown.duration(260);
  const exit = reduced ? FadeOut.duration(100) : FadeOutUp.duration(160);
  const label = accessibilityLabel ?? [title, detail].filter(Boolean).join('. ');

  const body = (
    <>
      <Pictogram name={icon} size={44} />
      <View style={styles.text}>
        <Animated.View key={`${title}|${detail ?? ''}`} entering={enter} exiting={exit}>
          <Text style={[type.title, styles.title, { color: colors.accentInk }]} numberOfLines={1}>
            {title}
          </Text>
          {detail ? (
            <Text style={[type.bodySmall, type.figure, { color: colors.accentInk }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </Animated.View>
      </View>
      {onPress ? <Icon name="arrow_forward" size={24} color={colors.accentInk} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={[styles.band, { backgroundColor: colors.accent }]}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: 'rgba(17,17,17,0.12)' }}
      style={({ pressed }) => [styles.band, { backgroundColor: colors.accent }, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  text: { flex: 1, overflow: 'hidden' },
  title: { fontSize: 18 },
  pressed: { transform: [{ scale: 0.985 }] },
});
