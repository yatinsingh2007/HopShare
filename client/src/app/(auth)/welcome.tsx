import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { PaybackArt, SplitArt, VerifiedArt } from '@/components/WelcomeArt';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

const SLIDES = [
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

export default function Welcome() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  return (
    <Screen style={styles.screen}>
      <View style={styles.brand}>
        <Image source={require('../../../assets/images/mark.png')} style={[styles.mark, { tintColor: colors.ink }]} />
        <Text style={[styles.wordmark, { color: colors.ink }]}>UniHop</Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.pager}
      >
        {SLIDES.map(({ title, body, Art }) => (
          <View key={title} style={[styles.slide, { width }]}>
            <Art />
            <View style={styles.copy}>
              <Text style={[type.headline, styles.center, { color: colors.ink }]}>{title}</Text>
              <Text style={[type.body, styles.center, { color: colors.muted }]}>{body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, { backgroundColor: i === page ? colors.accentText : colors.line }]} />
          ))}
        </View>
        <Button label="Get started" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} />
        <Button
          label="I have an account"
          variant="ghost"
          onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'login' } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 0 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 4 },
  mark: { width: 26, height: 26 },
  wordmark: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 21 },
  pager: { flex: 1 },
  slide: { paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 36 },
  copy: { gap: 10 },
  center: { textAlign: 'center' },
  footer: { paddingHorizontal: 24, gap: 12, paddingTop: 12 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 12, alignSelf: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
