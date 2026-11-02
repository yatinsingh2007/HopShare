import { Slot } from 'expo-router';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ThemeProvider } from '@/theme/ThemeProvider';

const getPublishableKey = () => {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (see client/.env.example)');
  return key;
};
const publishableKey = getPublishableKey();

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider>
        <Slot />
      </ThemeProvider>
    </ClerkProvider>
  );
}
