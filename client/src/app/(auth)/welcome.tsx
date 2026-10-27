import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

type Slide = { before: string; accent: string; after: string; body: string };

const SLIDES: Slide[] = [
  {
    before: 'Same road. ',
    accent: 'Quarter',
    after: ' the fare.',
    body: 'Someone near you is heading exactly where you are. Ride together, split it four ways.',
  },
  {
    before: 'Verified people. ',
    accent: 'Shared',
    after: ' live location.',
    body: 'Everyone is ID-checked. Your trip is visible to people you trust.',
  },
  {
    before: 'You book the cab. ',
    accent: 'We',
    after: ' do the math.',
    body: 'One person books, everyone pays them back over UPI.',
  },
];

export default function Welcome() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const slideWidth = width - 40;

  return (
    <Screen style={{ justifyContent: 'flex-end' }}>
      <Text style={[styles.brand, { color: colors.muted }]}>UniHop</Text>
      <FlatList
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.accent}
        style={{ flexGrow: 0 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth))}
        renderItem={({ item }) => (
          <View style={{ width: slideWidth, gap: 12 }}>
            <Text style={[styles.headline, { color: colors.ink }]}>
              {item.before}
              <Text style={{ color: colors.accentText }}>{item.accent}</Text>
              {item.after}
            </Text>
            <Text style={[styles.body, { color: colors.muted }]}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.accent}
            style={[
              styles.dot,
              i === index ? { width: 22, backgroundColor: colors.accent } : { backgroundColor: colors.line },
            ]}
          />
        ))}
      </View>
      <Button label="Get started" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} />
      <Button label="I have an account" variant="ghost" onPress={() => router.push('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 14, fontWeight: '600' },
  headline: { fontSize: 38, fontWeight: '800', lineHeight: 42, letterSpacing: -1 },
  body: { fontSize: 16, lineHeight: 23 },
  dots: { flexDirection: 'row', gap: 6, marginVertical: 8 },
  dot: { width: 8, height: 5, borderRadius: 3 },
});
