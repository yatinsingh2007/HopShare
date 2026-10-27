import { ActivityIndicator, Text } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { MeProvider, useMeContext } from '@/context/MeContext';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

function Gate() {
  const { me, loading, error, refresh } = useMeContext();
  const segments = useSegments();
  const { colors } = useTheme();
  const onSetup = segments[segments.length - 1] === 'profile-setup';

  if (!me && loading) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </Screen>
    );
  }
  if (!me) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Text style={{ color: colors.ink, fontSize: 16, textAlign: 'center' }}>{error}</Text>
        <Button label="Try again" onPress={refresh} />
      </Screen>
    );
  }
  if (!me.profileComplete && !onSetup) return <Redirect href="/profile-setup" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/welcome" />;
  return (
    <MeProvider>
      <Gate />
    </MeProvider>
  );
}
