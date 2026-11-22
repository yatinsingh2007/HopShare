import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AndroidSymbol } from 'expo-symbols';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pictogram } from '@/components/Pictogram';
import { PlaceRowSkeleton } from '@/components/Skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useActivity, type ActivityItem } from '@/hooks/useActivity';
import { type } from '@/theme/type';

const ICONS: Record<string, AndroidSymbol> = {
  request_new: 'person_add',
  request_accepted: 'how_to_reg',
  request_closed: 'close',
  cab_booked: 'local_taxi',
  payment_due: 'currency_rupee',
  payment_claimed: 'currency_rupee',
  payment_confirmed: 'check_circle',
};

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} hr ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

function Row({ item, index, isNew }: { item: ActivityItem; index: number; isNew: boolean }) {
  const { colors } = useTheme();
  const open = item.rideId ? () => router.push({ pathname: '/ride/[id]', params: { id: item.rideId! } }) : undefined;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(240)}>
      <Pressable
        onPress={open}
        disabled={!open}
        accessibilityRole={open ? 'button' : undefined}
        accessibilityLabel={`${isNew ? 'New. ' : ''}${item.text}. ${ago(item.createdAt)}`}
        android_ripple={{ color: colors.line }}
        style={[styles.row, isNew && { backgroundColor: colors.pill }]}
      >
        <Pictogram name={ICONS[item.kind] ?? 'notifications'} size={40} tone={isNew ? 'sign' : undefined} />
        <View style={styles.flex}>
          <Text style={[type.body, { color: colors.ink }]}>{item.text}</Text>
          <Text style={[type.bodySmall, { color: colors.muted }]}>{ago(item.createdAt)}</Text>
        </View>
        {open ? <Icon name="chevron_right" size={22} color={colors.muted} /> : null}
      </Pressable>
    </Animated.View>
  );
}

/** Everything that happened to me: requests, the cab, payments. Opening it marks all as read. */
export default function Activity() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { items, error, reload, markRead } = useActivity();
  const [refreshing, setRefreshing] = useState(false);
  // remember which were unread when the screen opened, so they stay highlighted while you read
  const [seenAt] = useState(() => Date.now());

  useEffect(() => {
    markRead();
  }, [markRead]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.line }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, { backgroundColor: colors.card, borderColor: colors.ink }, pressed && styles.pressed]}
        >
          <Icon name="arrow_back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">Activity</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
            tintColor={colors.ink}
            colors={[colors.accentInk]}
            progressBackgroundColor={colors.accent}
          />
        }
      >
        {error ? <Text style={[type.bodySmall, styles.note, { color: colors.danger }]}>{error}</Text> : null}
        {items === null ? (
          [0, 1, 2, 3].map((i) => <PlaceRowSkeleton key={i} index={i} />)
        ) : items.length ? (
          items.map((item, i) => (
            <Row key={item.id} item={item} index={i} isNew={!item.readAt && new Date(item.createdAt).getTime() <= seenAt} />
          ))
        ) : (
          <View style={styles.empty}>
            <Pictogram name="notifications" size={48} />
            <Text style={[type.body, styles.center, { color: colors.muted }]}>
              Nothing yet. Join requests, your cab and payments show up here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { transform: [{ scale: 0.97 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  back: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  body: { paddingVertical: 8, paddingHorizontal: 8 },
  note: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, minHeight: 64 },
  empty: { alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 64 },
});
