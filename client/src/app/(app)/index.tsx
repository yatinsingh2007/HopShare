import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useMeContext } from '@/context/MeContext';
import { useTheme } from '@/theme/ThemeProvider';

export default function Home() {
  const { me } = useMeContext();
  const { signOut } = useAuth();
  const { colors } = useTheme();

  return (
    <Screen>
      <Text style={[styles.hi, { color: colors.ink }]}>Hi, {me?.firstName}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>Where to?</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>Finding riders going your way is coming soon.</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hi: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
});
