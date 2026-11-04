import { useState, type ComponentType } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { PaybackArt, SplitArt, VerifiedArt } from '@/components/WelcomeArt';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

const PAD = 24;

const SLIDES: { title: string; body: string; Art: ComponentType }[] = [
  {
    title: 'Same road. Quarter the fare.',
    body: 'Someone near you is heading exactly where you are. Ride together, split it four ways.',
    Art: SplitArt,
  },
  {
    title: 'Verified people. Shared live location.',
    body: 'Everyone is ID-checked. Your trip is visible to people you trust.',
    Art: VerifiedArt,
  },
  {
    title: 'You book the cab. We do the math.',
    body: 'One person books, everyone pays them back over UPI.',
    Art: PaybackArt,
  },
];

/** The figure drifts slightly slower than the swipe, so each slide settles into place. */
function useArtStyle(x: SharedValue<number>, index: number, width: number) {
  return useAnimatedStyle(() => {
    const p = x.value / width - index;
    return {
      opacity: interpolate(p, [-0.8, 0, 0.8], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [-1, 0, 1], [-width * 0.25, 0, width * 0.25], Extrapolation.CLAMP) },
        { scale: interpolate(p, [-1, 0, 1], [0.9, 1, 0.9], Extrapolation.CLAMP) },
      ],
    };
  });
}

function Slide({ index, x, width }: { index: number; x: SharedValue<number>; width: number }) {
  const { colors } = useTheme();
  const { title, body, Art } = SLIDES[index];
  const artStyle = useArtStyle(x, index, width);
  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View
        style={[styles.art, artStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Art />
      </Animated.View>
      <View style={styles.copy}>
        <Text style={[type.headline, styles.center, { color: colors.ink }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[type.body, styles.center, { color: colors.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

function Dot({ x, index, width }: { x: SharedValue<number>; index: number; width: number }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / width - index);
    return {
      width: interpolate(d, [0, 1], [22, 8], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: colors.accentText }, style]} />;
}

export default function Welcome() {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // Measure the pager itself; the window size can be 0 or stale (web pre-render, split screen).
  const [measured, setMeasured] = useState(0);
  const width = measured || windowWidth || 1;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  return (
    <Screen style={styles.screen}>
      <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="UniHop">
        <Image source={require('../../../assets/images/mark.png')} style={[styles.mark, { tintColor: colors.ink }]} />
        <Text style={[styles.wordmark, { color: colors.ink }]}>UniHop</Text>
      </View>

      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
        style={styles.pager}
      >
        {SLIDES.map((s, i) => (
          <Slide key={s.title} index={i} x={x} width={width} />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {SLIDES.map((s, i) => (
            <Dot key={s.title} x={x} index={i} width={width} />
          ))}
        </View>
        <Button label="Get started" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} />
        <Button label="I have an account" variant="ghost" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'login' } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 0 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: PAD, paddingTop: 4 },
  mark: { width: 26, height: 26 },
  wordmark: { ...type.title, fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 21, letterSpacing: -0.4 },
  pager: { flex: 1 },
  slide: { flex: 1, paddingHorizontal: PAD, justifyContent: 'center', gap: 36 },
  art: { alignItems: 'center' },
  copy: { gap: 10, alignItems: 'center' },
  center: { textAlign: 'center' },
  footer: { paddingHorizontal: PAD, gap: 12, paddingTop: 12 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 12, alignSelf: 'center' },
  dot: { height: 6, borderRadius: 3 },
});
