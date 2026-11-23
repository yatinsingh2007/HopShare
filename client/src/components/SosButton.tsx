import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/context/ThemeContext';
import { fonts, type } from '@/theme/type';

const HOLD_MS = 3000;
const SIZE = 168;

/** Hold for 3 seconds to raise an SOS. A fill rises while held; letting go early cancels it. */
export function SosButton({ onTrigger, disabled }: { onTrigger: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    glow.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [glow, reduced]);

  const fire = () => {
    Vibration.vibrate([0, 80, 60, 160]);
    onTrigger();
  };

  const start = () => {
    Vibration.vibrate(30);
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) {
        scheduleOnRN(fire);
        progress.value = 0;
      }
    });
  };
  const cancel = () => {
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 200 });
  };

  const fill = useAnimatedStyle(() => ({ height: `${progress.value * 100}%` }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - glow.value), transform: [{ scale: 1 + glow.value * 0.25 }] }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, { backgroundColor: colors.danger }, ring]} />
      <Pressable
        onPressIn={start}
        onPressOut={cancel}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="SOS. Hold for 3 seconds"
        accessibilityHint="Then call 112 or text your trusted contacts your live location"
        accessibilityActions={[{ name: 'activate', label: 'Raise SOS' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && fire()}
        style={[styles.button, { backgroundColor: colors.danger }]}
      >
        <Animated.View style={[styles.fill, fill]} />
        <Text style={[styles.sos, { color: colors.dangerInk }]}>SOS</Text>
        <Text style={[type.bodySmall, { color: colors.dangerInk }]}>Hold 3 seconds</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE + 40, height: SIZE + 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ring: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 6,
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' },
  sos: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 52, letterSpacing: 2 },
});
