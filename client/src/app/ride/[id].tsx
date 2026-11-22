import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { CabBooking, type Booking, type BookingInput } from '@/components/CabBooking';
import { Icon } from '@/components/Icon';
import { clock, groupCode } from '@/components/RideCard';
import { RouteMap } from '@/components/RouteMap';
import { Bone, SkeletonCard } from '@/components/Skeleton';
import { SignBand } from '@/components/SignBand';
import { useSession } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ApiError } from '@/services/api';
import type { Place } from '@/services/cabApps';
import { fonts, type } from '@/theme/type';

type Member = { id: string; firstName: string | null; isCreator: boolean; isMe: boolean };
type Ride = {
  id: string;
  pickup: Place;
  destination: Place;
  leaveAt: string;
  live: boolean;
  isCreator: boolean;
  members: Member[];
  seatsLeft: number;
  booking: Booking | null;
};

type JoinRequest = {
  id: string;
  firstName: string | null;
  createdAt: string;
  pickup: Place;
  destination: Place;
  pickupOffM: number;
  dropOffM: number;
};

const SHEET_OVERLAP = 28;
const metres = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);

const day = (iso: string) => {
  const d = new Date(iso);
  return new Date().toDateString() === d.toDateString()
    ? 'Today'
    : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const minutesUntil = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 60_000);

function MemberRow({ member, index }: { member: Member; index: number }) {
  const { colors } = useTheme();
  const name = member.firstName ?? 'Rider';
  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 50).duration(240)}
      accessible
      accessibilityLabel={`${member.isMe ? 'You' : name}${member.isCreator ? ', started the group and books the cab' : ''}`}
      style={styles.member}
    >
      <View style={[styles.initial, { backgroundColor: member.isCreator ? colors.accent : colors.plate }]}>
        <Text style={[styles.initialText, { color: member.isCreator ? colors.accentInk : colors.plateInk }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>
          {name}
          {member.isMe ? <Text style={{ color: colors.muted }}> (you)</Text> : null}
        </Text>
        {member.isCreator ? (
          <Text style={[type.bodySmall, { color: colors.muted }]}>Started the group · books the cab</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function RequestCard({ req, selected, busy, onSelect, onAccept, onDecline }: {
  req: JoinRequest;
  selected: boolean;
  busy: 'accept' | 'decline' | null;
  onSelect: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { colors } = useTheme();
  const name = req.firstName ?? 'A rider';
  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[
        styles.card,
        styles.request,
        { backgroundColor: colors.card, borderColor: selected ? colors.ink : colors.line, borderWidth: selected ? 2 : 1.5 },
      ]}
    >
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${name} wants to join. Gets on at ${req.pickup.name}, ${metres(req.pickupOffM)} from your pickup. Gets off at ${req.destination.name}, ${metres(req.dropOffM)} from your drop. Show on map`}
        style={styles.requestHead}
      >
        <View style={[styles.initial, { backgroundColor: colors.plate }]}>
          <Text style={[styles.initialText, { color: colors.plateInk }]}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>{name} wants to join</Text>
          <Text style={[type.bodySmall, type.figure, { color: colors.muted }]} numberOfLines={1}>
            On at {req.pickup.name} · {metres(req.pickupOffM)} from yours
          </Text>
          <Text style={[type.bodySmall, type.figure, { color: colors.muted }]} numberOfLines={1}>
            Off at {req.destination.name} · {metres(req.dropOffM)} from yours
          </Text>
        </View>
        <Icon name={selected ? 'visibility' : 'map'} size={22} color={selected ? colors.ink : colors.muted} />
      </Pressable>
      <View style={styles.requestActions}>
        <View style={styles.flex}>
          <Button label="Decline" variant="ghost" loading={busy === 'decline'} disabled={!!busy} onPress={onDecline} />
        </View>
        <View style={styles.flex}>
          <Button label="Accept" icon="check" loading={busy === 'accept'} disabled={!!busy} onPress={onAccept} />
        </View>
      </View>
    </Animated.View>
  );
}

function OpenSeat({ index }: { index: number }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 50).duration(240)} style={styles.member}>
      <View style={[styles.initial, styles.open, { borderColor: colors.muted }]}>
        <Icon name="person" size={20} color={colors.muted} />
      </View>
      <Text style={[type.body, { color: colors.muted }]}>Open seat</Text>
    </Animated.View>
  );
}

// the ride screen's layout while it loads: map, leaving-time plate, stops, riders
function RideSkeleton({ mapHeight }: { mapHeight: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.flex} accessible accessibilityLabel="Loading the ride">
      <View style={{ height: mapHeight }}>
        <Bone height={mapHeight} radius={0} />
      </View>
      <View style={[styles.sheet, styles.body, { marginTop: -SHEET_OVERLAP, backgroundColor: colors.bg }]}>
        <View style={[styles.handle, { backgroundColor: colors.line }]} />
        <Bone height={92} radius={12} />
        <SkeletonCard style={styles.skeletonStops}>
          <Bone width="25%" height={12} />
          <Bone width="70%" height={18} />
          <Bone width="25%" height={12} />
          <Bone width="60%" height={18} />
        </SkeletonCard>
        <SkeletonCard index={1} style={styles.skeletonStops}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.member}>
              <Bone width={40} height={40} radius={6} />
              <Bone width="45%" height={16} />
            </View>
          ))}
        </SkeletonCard>
      </View>
    </View>
  );
}

export default function RideScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { request } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [height, setHeight] = useState(0);
  const [ride, setRide] = useState<Ride | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [acting, setActing] = useState<{ id: string; kind: 'accept' | 'decline' } | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRide = useCallback(
    () =>
      request<Ride>(`/api/rides/${id}`)
        .then(async (found) => {
          setRide(found);
          setError(null);
          // only the person who started the group answers requests
          setRequests(found.isCreator && found.live ? await request<JoinRequest[]>(`/api/rides/${id}/requests`) : []);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')),
    [request, id],
  );

  // no live updates yet, so look again each time the screen comes into view
  useFocusEffect(
    useCallback(() => {
      fetchRide();
    }, [fetchRide]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await fetchRide();
    setRefreshing(false);
  };

  const answer = async (req: JoinRequest, kind: 'accept' | 'decline') => {
    setActing({ id: req.id, kind });
    setActError(null);
    try {
      await request(`/api/rides/${id}/requests/${req.id}/${kind === 'accept' ? 'accept' : 'reject'}`, { method: 'POST' });
      if (selected === req.id) setSelected(null);
    } catch (e) {
      setActError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setActing(null);
      await fetchRide();
    }
  };

  // returns an error message, or null when saved
  const saveBooking = async (input: BookingInput) => {
    try {
      const booking = await request<Booking>(`/api/rides/${id}/booked`, { method: 'POST', body: input });
      setRide((r) => (r ? { ...r, booking } : r));
      // booking closes the group, so any pending requests are gone
      setRequests([]);
      setSelected(null);
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
    }
  };

  const mapHeight = Math.round(height * 0.36);
  const creator = ride?.members.find((m) => m.isCreator);

  const back = (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [
        styles.back,
        { top: insets.top + 8, backgroundColor: colors.card, borderColor: colors.ink },
        pressed && styles.pressed,
      ]}
    >
      <Icon name="arrow_back" size={22} color={colors.ink} />
    </Pressable>
  );

  if (!ride) {
    return (
      <View
        style={[styles.flex, error ? styles.centered : null, { backgroundColor: colors.bg }]}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      >
        {error ? (
          <Animated.View entering={FadeIn} style={styles.message}>
            <Text style={[type.title, styles.center, { color: colors.ink }]}>Couldn&apos;t open this ride</Text>
            <Text style={[type.body, styles.center, { color: colors.muted }]}>{error}</Text>
            <Button label="Try again" variant="ghost" icon="refresh" onPress={fetchRide} />
          </Animated.View>
        ) : height > 0 ? (
          <RideSkeleton mapHeight={Math.round(height * 0.36)} />
        ) : null}
        {back}
      </View>
    );
  }

  const code = groupCode(ride.id);
  const mins = minutesUntil(ride.leaveAt);
  const soft = 'rgba(255,255,255,0.78)';

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 ? (
        <>
          <View style={{ height: mapHeight }}>
            <RouteMap
              pickup={ride.pickup}
              destination={ride.destination}
              extra={requests.find((r) => r.id === selected)?.destination ?? null}
              bottomInset={SHEET_OVERLAP}
            />
          </View>

          <ScrollView
            style={[styles.sheet, { marginTop: -SHEET_OVERLAP, backgroundColor: colors.bg, shadowColor: '#000' }]}
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
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
            <View style={[styles.handle, { backgroundColor: colors.line }]} />

            <Animated.View
              entering={FadeInDown.duration(280)}
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${ride.live ? 'Live' : 'Past'} group ${code}, leaves ${day(ride.leaveAt)} at ${clock(ride.leaveAt)}`}
              style={[styles.plate, { backgroundColor: ride.live ? colors.coach : colors.card, borderColor: colors.line, borderWidth: ride.live ? 0 : 1.5 }]}
            >
              <View style={[styles.code, { backgroundColor: ride.live ? 'rgba(0,0,0,0.22)' : colors.bg }]}>
                <Text style={[styles.codeText, { color: ride.live ? colors.accent : colors.ink }]}>{code}</Text>
                <Text style={[type.meta, { color: ride.live ? soft : colors.muted }]}>{ride.live ? 'LIVE' : 'PAST'}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[type.bodySmall, { color: ride.live ? soft : colors.muted }]}>{day(ride.leaveAt)} · leaves at</Text>
                <Text style={[type.monument, type.figure, { color: ride.live ? colors.coachInk : colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {clock(ride.leaveAt)}
                </Text>
              </View>
            </Animated.View>

            {ride.live && requests.length ? (
              <SignBand
                icon="how_to_reg"
                title={`${requests.length} ${requests.length === 1 ? 'rider wants' : 'riders want'} to join`}
                detail="Tap one to see their drop on the map"
              />
            ) : ride.live ? (
              <SignBand
                icon="directions_walk"
                title={mins > 1 ? `Leave in ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`}` : 'Time to go'}
                detail={`Walk to ${ride.pickup.name}`}
              />
            ) : null}

            <Animated.View
              entering={FadeInDown.delay(60).duration(260)}
              style={[styles.card, styles.stops, { backgroundColor: colors.card, borderColor: colors.line }]}
            >
              <View style={styles.rail} importantForAccessibility="no-hide-descendants">
                <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.accentInk }]} />
                <View style={[styles.line, { backgroundColor: colors.route }]} />
                <View style={[styles.square, { backgroundColor: colors.coach }]} />
              </View>
              <View style={[styles.flex, styles.stopNames]}>
                <View>
                  <Text style={[type.meta, { color: colors.muted }]}>PICKUP</Text>
                  <Text style={[type.title, { color: colors.ink }]}>{ride.pickup.name}</Text>
                </View>
                <View>
                  <Text style={[type.meta, { color: colors.muted }]}>DROP</Text>
                  <Text style={[type.title, { color: colors.ink }]}>{ride.destination.name}</Text>
                </View>
              </View>
            </Animated.View>

            {requests.length || actError ? (
              <View style={styles.section}>
                <Text style={[type.title, { color: colors.ink }]}>Requests</Text>
                {actError ? <Text style={[type.body, { color: colors.danger }]}>{actError}</Text> : null}
                {requests.map((r) => (
                  <RequestCard
                    key={r.id}
                    req={r}
                    selected={selected === r.id}
                    busy={acting?.id === r.id ? acting.kind : null}
                    onSelect={() => setSelected((s) => (s === r.id ? null : r.id))}
                    onAccept={() => answer(r, 'accept')}
                    onDecline={() => answer(r, 'decline')}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[type.title, { color: colors.ink }]}>Riders</Text>
                <Text style={[type.body, type.figure, { color: colors.muted }]}>{ride.members.length} of 4</Text>
              </View>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
                {ride.members.map((m, i) => (
                  <MemberRow key={m.id} member={m} index={i} />
                ))}
                {ride.live && !ride.booking
                  ? Array.from({ length: ride.seatsLeft }, (_, i) => <OpenSeat key={i} index={ride.members.length + i} />)
                  : null}
              </View>
            </View>

            {ride.live ? (
              <Animated.View entering={FadeInDown.delay(200).duration(260)}>
                <CabBooking
                  pickup={ride.pickup}
                  drop={ride.destination}
                  booking={ride.booking}
                  isBooker={ride.isCreator}
                  bookerName={creator?.firstName ?? 'The person who started the group'}
                  onSave={saveBooking}
                />
              </Animated.View>
            ) : null}
          </ScrollView>

          {back}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  pressed: { transform: [{ scale: 0.97 }] },
  back: {
    position: 'absolute',
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  message: { gap: 10, paddingHorizontal: 32, alignItems: 'center' },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 12,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  body: { paddingHorizontal: 20, gap: 20 },
  plate: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 12, padding: 14 },
  code: { width: 76, alignSelf: 'stretch', borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 10 },
  codeText: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  card: { borderWidth: 1.5, borderRadius: 12, padding: 16 },
  stops: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', paddingTop: 22, paddingBottom: 8, width: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  line: { width: 3, flex: 1, marginVertical: 4, borderRadius: 2 },
  square: { width: 14, height: 14, borderRadius: 3 },
  stopNames: { gap: 16 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  initial: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  open: { borderWidth: 1.5, borderStyle: 'dashed' },
  request: { gap: 14 },
  skeletonStops: { padding: 16, gap: 10 },
  requestHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  requestActions: { flexDirection: 'row', gap: 10 },
  initialText: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 24 },
});
