import { ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/context/ThemeContext';

/** Full-screen wait in the app's own colours, so loading never shows as a blank white page. */
export function Loading() {
  const { colors } = useTheme();
  return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.muted} accessibilityLabel="Loading" />
    </Screen>
  );
}
