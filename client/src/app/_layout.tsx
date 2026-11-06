import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ThemeContext, type ThemePreference } from '@/context/ThemeContext';
import { palettes } from '@/theme/tokens';
import { Loading } from '@/components/Loading';

SplashScreen.preventAutoHideAsync().catch(() => {});

const getPublishableKey = () => {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (see client/.env.example)');
  return key;
};
const publishableKey = getPublishableKey();
const THEME_KEY = 'hopshare.themePreference';

/** Signed out: only the (auth) screens exist. Signed in: only the tabs and profile setup. */
function RootStack() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // If the font fails to load, render anyway with the system face rather than hang on the splash.
  const [fontsLoaded, fontError] = useFonts({ SchibstedGrotesk_700Bold, SchibstedGrotesk_800ExtraBold });
  const ready = fontsLoaded || !!fontError;

  // Theme: 'system' follows the phone; 'light' / 'dark' is the rider's saved choice.
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPreference(saved);
      })
      .catch(() => {});
  }, []);

  const scheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const theme = useMemo(
    () => ({
      colors: palettes[scheme],
      scheme,
      preference,
      setPreference: (p: ThemePreference) => {
        setPreference(p);
        AsyncStorage.setItem(THEME_KEY, p).catch(() => {});
      },
    }),
    [scheme, preference],
  );

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeContext.Provider value={theme}>
        <RootStack />
      </ThemeContext.Provider>
    </ClerkProvider>
  );
}
