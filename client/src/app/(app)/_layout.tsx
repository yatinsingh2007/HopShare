import { ActivityIndicator, Text } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { MeProvider, useMeContext } from '@/context/MeContext';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

const friendlyError = (status: number | null, message: string | null) =>
  status === 401 ? 'Your session expired. Please sign in again.' : message;

function Gate() {
  const { me, loading, error, errorStatus, refresh } = useMeContext();
  const { signOut } = useAuth();
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
        <Text style={{ color: colors.ink, fontSize: 16, textAlign: 'center' }}>
          {friendlyError(errorStatus, error)}
        </Text>
        {errorStatus !== 401 && errorStatus !== 403 ? <Button label="Try again" onPress={refresh} /> : null}
        <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
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
