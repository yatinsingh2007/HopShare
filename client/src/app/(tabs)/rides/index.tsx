import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Pictogram } from '@/components/Pictogram';
import { RequestRow } from '@/components/RequestRow';
import { RideCard } from '@/components/RideCard';
import { RideCardSkeleton } from '@/components/Skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useMyRequests } from '@/hooks/useMyRequests';
import { useMyRides } from '@/hooks/useMyRides';
import { type } from '@/theme/type';

/** Rides tab: the ride I'm in now, asks still waiting, and everything before. */
export default function Rides() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { rides, error, reload, liveRide } = useMyRides();
  const { requests, reload: reloadRequests, withdraw } = useMyRequests();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    reloadRequests();
    await reload();
    setRefreshing(false);
  };

  const past = rides?.filter((r) => !r.live) ?? [];
  const owing = past.filter((r) => r.myShare?.status === 'PENDING').length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.ink}
          colors={[colors.accentInk]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <Animated.View entering={FadeInDown.duration(260)} style={styles.gap4}>
        <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">Rides</Text>
        <Text style={[type.bodySmall, { color: owing ? colors.danger : colors.muted }]}>
          {owing ? `You still owe on ${owing} ${owing === 1 ? 'ride' : 'rides'}` : 'Your groups, now and before'}
        </Text>
      </Animated.View>

      {error ? <Text style={[type.bodySmall, { color: colors.danger }]}>{error}</Text> : null}

      <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
        <Text style={[type.title, { color: colors.ink }]}>Now</Text>
        {rides === null ? (
          <RideCardSkeleton />
        ) : liveRide ? (
          <RideCard ride={liveRide} />
        ) : (
          <Animated.View
            entering={FadeInDown.delay(60).duration(260)}
            style={[styles.empty, { borderColor: colors.line }]}
          >
            <View style={styles.emptyRow}>
              <Pictogram name="directions_car" size={36} />
              <Text style={[type.bodySmall, styles.flex, { color: colors.muted }]}>
                You&apos;re not in a group right now. Pick a destination and find riders going your way.
              </Text>
            </View>
            <Button label="Find riders" variant="ghost" icon="group" onPress={() => router.navigate('/home')} />
          </Animated.View>
        )}
      </Animated.View>

      {requests.length ? (
        <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
          <Text style={[type.title, { color: colors.ink }]}>Waiting for an answer</Text>
          {requests.map((r) => (
            <RequestRow key={r.id} req={r} onWithdraw={() => withdraw(r).catch(() => {})} />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[type.title, { color: colors.ink }]}>Past rides</Text>
          {past.length ? <Text style={[type.body, type.figure, { color: colors.muted }]}>{past.length}</Text> : null}
        </View>
        {rides === null ? (
          [0, 1].map((i) => <RideCardSkeleton key={i} index={i + 1} />)
        ) : past.length ? (
          past.map((ride, i) => <RideCard key={ride.id} ride={ride} index={i} />)
        ) : (
          <Text style={[type.bodySmall, { color: colors.muted }]}>
            Rides you finish show up here, with the fare and who paid.
          </Text>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 24 },
  gap4: { gap: 4 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  empty: { gap: 14, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 16 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
