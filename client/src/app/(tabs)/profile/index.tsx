import { StyleSheet, Text } from 'react-native';
import { useAuth } from '@clerk/expo';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useMe } from '@/hooks/useMe';
import { useTheme } from '@/context/ThemeContext';

export default function Profile() {
  const { me } = useMe();
  const { signOut } = useAuth();
  const { colors } = useTheme();

  return (
    <Screen>
      <Text style={[styles.name, { color: colors.ink }]}>{me?.firstName ?? 'Profile'}</Text>
      {me?.upiId ? <Text style={{ color: colors.muted, fontSize: 14 }}>{me.upiId}</Text> : null}
      <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
});
