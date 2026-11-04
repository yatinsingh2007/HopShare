import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useMe } from '@/hooks/useMe';
import { useTheme } from '@/context/ThemeContext';

export default function Home() {
  const { me } = useMe();
  const { colors } = useTheme();

  return (
    <Screen>
      <Text style={[styles.hi, { color: colors.ink }]}>Hi, {me?.firstName}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>Where to?</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>Finding riders going your way is coming soon.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hi: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
});
