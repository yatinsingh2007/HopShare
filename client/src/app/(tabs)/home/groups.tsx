import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { clock, groupCode, SeatStrip } from '@/components/RideCard';
import { SignBand } from '@/components/SignBand';
import { useSession } from '@/context/AuthContext';
import { useMyRequests, type MyRequest } from '@/hooks/useMyRequests';
import { useTheme } from '@/context/ThemeContext';
import { ApiError } from '@/services/api';
import type { Place } from '@/services/cabApps';
import { notifyRideLive } from '@/services/notifications';
import { type } from '@/theme/type';

type Group = {
  id: string;
  pickup: Place;
  destination: Place;
  leaveAt: string;
  walkToPickupM: number;
  walkFromDropM: number;
  members: number;
  seatsLeft: number;
  creatorName: string | null;
  requested: boolean;
};

const SEATS = 4;

const fromNow = (iso: string) => {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes <= 1) return 'leaving now';
  if (minutes < 60) return `in ${minutes} min`;
  return `in ${Math.floor(minutes / 60)} hr ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
};
const metres = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);
// about 80 m a minute on foot
const walkMinutes = (m: number) => Math.max(1, Math.round(m / 80));

function Stop({ kind, name, detail }: { kind: 'pickup' | 'drop'; name: string; detail: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stop}>
      <View style={styles.stopMark}>
        {kind === 'pickup' ? (
          <View style={[styles.stopDot, { backgroundColor: colors.accent, borderColor: colors.accentInk }]} />
        ) : (
          <View style={[styles.stopSquare, { backgroundColor: colors.coach }]} />
        )}
      </View>
      <View style={styles.flex}>
        <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
        <View style={styles.walk}>
          <Icon name="directions_walk" size={16} color={colors.muted} />
          <Text style={[type.bodySmall, type.figure, { color: colors.muted }]}>{detail}</Text>
        </View>
      </View>
    </View>
  );
}

function GroupCard({ group, index, pending, asking, onAsk, onWithdraw }: {
  group: Group;
  index: number;
  /** my waiting request for this group, if I've asked */
  pending: MyRequest | null;
  asking: boolean;
  onAsk: () => void;
  onWithdraw: (r: MyRequest) => void;
}) {
  const { colors } = useTheme();
  const requested = group.requested || !!pending;
  const creator = group.creatorName ?? 'the group';
  const seatText = `${group.members} of ${SEATS}`;
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(280)}
      accessibilityLabel={`Group ${groupCode(group.id)}, started by ${creator}. Leaves at ${clock(group.leaveAt)}, ${fromNow(group.leaveAt)}. Pickup ${group.pickup.name}, ${metres(group.walkToPickupM)} walk. Drop ${group.destination.name}, ${metres(group.walkFromDropM)} from yours. ${seatText} riders, ${group.seatsLeft} seats left.`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text style={[type.display, type.figure, { color: colors.ink }]}>{clock(group.leaveAt)}</Text>
          <Text style={[type.bodySmall, { color: colors.muted }]}>
            {fromNow(group.leaveAt)} · group {groupCode(group.id)}
          </Text>
        </View>
        <View style={styles.seatBlock}>
          <SeatStrip members={group.members} />
          <Text style={[type.bodySmall, type.figure, { color: colors.ink }]}>
            {group.seatsLeft} {group.seatsLeft === 1 ? 'seat' : 'seats'} left
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.line }]} />

      <View style={styles.stops}>
        <Stop
          kind="pickup"
          name={group.pickup.name}
          detail={`${metres(group.walkToPickupM)} · ${walkMinutes(group.walkToPickupM)} min walk to pickup`}
        />
        <Stop
          kind="drop"
          name={group.destination.name}
          detail={`${metres(group.walkFromDropM)} from your drop`}
        />
      </View>

      {requested ? (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.waiting, { backgroundColor: colors.pill }]}>
          <Icon name="hourglass_top" size={20} color={colors.accentText} />
          <Text style={[type.label, styles.flex, { color: colors.ink }]} numberOfLines={2}>
            Asked to join · waiting for {creator}
          </Text>
          {pending ? <Button label="Withdraw" variant="text" onPress={() => onWithdraw(pending)} /> : null}
        </Animated.View>
      ) : (
        <Button label={`Ask ${creator} to join`} icon="person_add" variant="ghost" loading={asking} onPress={onAsk} />
      )}
    </Animated.View>
  );
}

function SkeletonCard({ index }: { index: number }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      entering={FadeIn.delay(index * 80)}
      style={[styles.card, styles.skeleton, { backgroundColor: colors.card, borderColor: colors.line }, style]}
    >
      <View style={[styles.bar, { width: '38%', height: 34, backgroundColor: colors.line }]} />
      <View style={[styles.bar, { width: '72%', backgroundColor: colors.line }]} />
      <View style={[styles.bar, { width: '56%', backgroundColor: colors.line }]} />
    </Animated.View>
  );
}

export default function Groups() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { request } = useSession();
  const params = useLocalSearchParams<{ pickup: string; destination: string; leaveAt: string; leaveIn: string }>();

  const pickup = useMemo<Place>(() => JSON.parse(params.pickup), [params.pickup]);
  const destination = useMemo<Place>(() => JSON.parse(params.destination), [params.destination]);
  const leaveAt = params.leaveAt;

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [started, setStarted] = useState<string | null>(null);
  const { requests, reload: reloadRequests, withdraw } = useMyRequests();
  const [asking, setAsking] = useState<string | null>(null);
  const [asked, setAsked] = useState<Group | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const fetchGroups = useCallback(() => {
    const query = new URLSearchParams({
      pickupLat: String(pickup.latitude),
      pickupLon: String(pickup.longitude),
      dropLat: String(destination.latitude),
      dropLon: String(destination.longitude),
      leaveAt,
    });
    return request<Group[]>(`/api/rides/match?${query}`)
      .then((found) => {
        setGroups(found);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'));
  }, [request, pickup, destination, leaveAt]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const retry = () => {
    setError(null);
    setGroups(null);
    fetchGroups();
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  };

  // ask with my own stops, so the creator can see where I get on and off
  const askToJoin = async (group: Group) => {
    setAsking(group.id);
    setAskError(null);
    try {
      await request(`/api/rides/${group.id}/requests`, { method: 'POST', body: { pickup, destination } });
      setGroups((all) => all?.map((g) => (g.id === group.id ? { ...g, requested: true } : g)) ?? all);
      setAsked(group);
      reloadRequests();
    } catch (e) {
      setAskError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setAsking(null);
    }
  };

  const withdrawRequest = async (r: MyRequest) => {
    setAskError(null);
    try {
      await withdraw(r);
      setGroups((all) => all?.map((g) => (g.id === r.rideId ? { ...g, requested: false } : g)) ?? all);
      if (asked?.id === r.rideId) setAsked(null);
    } catch (e) {
      setAskError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const startGroup = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const ride = await request<{ id: string }>('/api/rides', { method: 'POST', body: { pickup, destination, leaveAt } });
      setStarted(ride.id);
      notifyRideLive(pickup, destination, leaveAt);
    } catch (e) {
      setStartError(
        e instanceof ApiError && e.status === 409
          ? "You're already in a group. One group at a time."
          : e instanceof ApiError
            ? e.message
            : 'Something went wrong. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  const loading = groups === null && !error;
  const none = groups?.length === 0;
  const leaving = params.leaveIn === '0' ? 'Leaving now' : `Leaving around ${clock(leaveAt)}`;

  const band = () => {
    if (started) {
      return (
        <SignBand
          icon="check_circle"
          title={`Your group ${groupCode(started)} is live`}
          detail="Riders on this route can find it now"
          onPress={() => router.push({ pathname: '/ride/[id]', params: { id: started } })}
          accessibilityLabel={`Your group ${groupCode(started)} is live. Open your ride`}
        />
      );
    }
    if (loading || error) return null;
    if (asked) {
      return (
        <SignBand
          icon="hourglass_top"
          title={`Asked to join ${groupCode(asked.id)}`}
          detail={`${asked.creatorName ?? 'The group'} will accept or decline. It's on Home too.`}
        />
      );
    }
    if (none) {
      return <SignBand icon="group_add" title="No group on this route yet" detail="Start one and riders going your way will find you" />;
    }
    const first = groups![0];
    return (
      <SignBand
        icon="directions_walk"
        title={`Soonest leaves ${clock(first.leaveAt)}`}
        detail={`${metres(first.walkToPickupM)} walk · ${first.seatsLeft} ${first.seatsLeft === 1 ? 'seat' : 'seats'} left`}
      />
    );
  };

  const body = () => {
    if (error) {
      return (
        <Animated.View entering={FadeIn} style={styles.message}>
          <Text style={[type.title, { color: colors.ink }]}>Couldn&apos;t look for groups</Text>
          <Text style={[type.body, { color: colors.muted }]}>{error}</Text>
          <View style={styles.retry}>
            <Button label="Try again" variant="ghost" icon="refresh" onPress={retry} />
          </View>
        </Animated.View>
      );
    }
    if (loading) return [0, 1, 2].map((i) => <SkeletonCard key={i} index={i} />);
    if (none) {
      return (
        <Animated.View entering={FadeIn.duration(240)} style={styles.message}>
          <Text style={[type.body, { color: colors.muted }]}>
            We look for groups whose pickup is within 1 km of yours, whose drop is within 1 km of yours, and that
            leave within 15 minutes of your time. Pull down to look again.
          </Text>
        </Animated.View>
      );
    }
    return (
      <>
        {askError ? <Text style={[type.body, { color: colors.danger }]}>{askError}</Text> : null}
        {groups!.map((g, i) => (
          <GroupCard
            key={g.id}
            group={g}
            index={i}
            pending={requests.find((r) => r.rideId === g.id) ?? null}
            asking={asking === g.id}
            onAsk={() => askToJoin(g)}
            onWithdraw={withdrawRequest}
          />
        ))}
      </>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, { backgroundColor: colors.card, borderColor: colors.ink }, pressed && styles.pressed]}
        >
          <Icon name="arrow_back" size={22} color={colors.ink} />
        </Pressable>
        <View style={[styles.pill, { borderColor: colors.ink }]}>
          <Icon name="schedule" size={16} color={colors.ink} />
          <Text style={[type.label, type.figure, { color: colors.ink }]}>{leaving}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
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
        <View style={styles.head}>
          <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">
            {none || loading || error
              ? 'Riders going your way'
              : `${groups!.length} ${groups!.length === 1 ? 'group' : 'groups'} going your way`}
          </Text>
          <View style={styles.route}>
            <View style={[styles.stopDot, styles.smallMark, { backgroundColor: colors.accent, borderColor: colors.accentInk }]} />
            <Text style={[type.body, styles.flexShrink, { color: colors.ink }]} numberOfLines={1}>{pickup.name}</Text>
          </View>
          <View style={styles.route}>
            <View style={[styles.stopSquare, styles.smallMark, { backgroundColor: colors.coach }]} />
            <Text style={[type.body, styles.flexShrink, { color: colors.ink }]} numberOfLines={1}>{destination.name}</Text>
          </View>
        </View>

        {band()}
        {body()}
      </ScrollView>

      {!loading && !error && !started ? (
        <Animated.View
          entering={FadeInDown.duration(260)}
          style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.line }]}
        >
          {startError ? <Text style={[type.bodySmall, { color: colors.danger }]}>{startError}</Text> : null}
          <Button
            label={none ? 'Start my own group' : 'None suit me: start my own'}
            icon="add"
            variant={none ? 'primary' : 'ghost'}
            loading={starting}
            onPress={startGroup}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  top: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5 },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16 },
  head: { gap: 6, marginBottom: 4 },
  route: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallMark: { marginTop: 0 },
  card: { borderWidth: 1.5, borderRadius: 12, padding: 16, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  seatBlock: { alignItems: 'flex-end', gap: 8, paddingTop: 10 },
  divider: { height: 1 },
  stops: { gap: 14 },
  stop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stopMark: { width: 16, alignItems: 'center', paddingTop: 4 },
  stopDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  stopSquare: { width: 14, height: 14, borderRadius: 3 },
  walk: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingLeft: 12, borderRadius: 8 },
  skeleton: { gap: 12 },
  bar: { height: 14, borderRadius: 4 },
  message: { gap: 8, paddingVertical: 8 },
  retry: { marginTop: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 8, borderTopWidth: 1 },
});
