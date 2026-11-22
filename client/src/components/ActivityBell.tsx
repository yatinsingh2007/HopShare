import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { useActivity } from '@/hooks/useActivity';
import { fonts } from '@/theme/type';

/** The bell on Home: opens the Activity feed, with a yellow count of unread items. */
export function ActivityBell() {
  const { colors } = useTheme();
  const { unread } = useActivity();
  return (
    <Pressable
      onPress={() => router.push('/home/activity')}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Activity, ${unread} new` : 'Activity'}
      style={({ pressed }) => [styles.bell, { backgroundColor: colors.card, borderColor: colors.line }, pressed && styles.pressed]}
    >
      <Icon name="notifications" size={22} color={colors.ink} />
      {unread ? (
        <Animated.View
          entering={ZoomIn.duration(180)}
          exiting={ZoomOut.duration(120)}
          style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.bg }]}
        >
          <Text style={[styles.count, { color: colors.accentInk }]}>{unread > 9 ? '9+' : unread}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.95 }] },
  bell: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontFamily: fonts.extrabold, fontSize: 11, lineHeight: 14 },
});
