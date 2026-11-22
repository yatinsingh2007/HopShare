import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { fonts } from '@/theme/type';

// Material 3 navigation bar: the selected destination sits on a yellow indicator pill.
function TabIcon({ name, focused }: { name: AndroidSymbol; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.indicator, focused && { backgroundColor: colors.accent }]}>
      <Icon name={name} size={22} color={focused ? colors.accentInk : colors.muted} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 72, paddingTop: 8 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="rides"
        options={{ title: 'Rides', tabBarIcon: ({ focused }) => <TabIcon name="directions_car" focused={focused} /> }}
      />
      <Tabs.Screen
        name="payments"
        options={{ title: 'Payments', tabBarIcon: ({ focused }) => <TabIcon name="currency_rupee" focused={focused} /> }}
      />
      <Tabs.Screen
        name="safety"
        options={{ title: 'Safety', tabBarIcon: ({ focused }) => <TabIcon name="shield" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  indicator: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 4 },
});
