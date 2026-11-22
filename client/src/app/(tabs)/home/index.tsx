import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pictogram } from '@/components/Pictogram';
import { clock, groupCode, RideCard } from '@/components/RideCard';
import { RouteMap } from '@/components/RouteMap';
import { SignBand } from '@/components/SignBand';
import { PlaceRowSkeleton } from '@/components/Skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useMe } from '@/hooks/useMe';
import { useMyRequests, type MyRequest } from '@/hooks/useMyRequests';
import { useMyRides } from '@/hooks/useMyRides';
import {
  distanceBetween,
  getRecentDestinations,
  inRideRange,
  MAX_RIDE_KM,
  nearbyStations,
  nameForPoint,
  saveRecentDestination,
  searchPlaces,
  type PlaceResult,
} from '@/services/places';
import { type } from '@/theme/type';

type Field = 'pickup' | 'destination';

// "Now" or a time within the next 2 hours (spec 4.3). Matching uses ±15 minutes around it.
const LEAVING = [
  { minutes: 0, label: 'Now' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hr' },
  { minutes: 90, label: '1½ hr' },
  { minutes: 120, label: '2 hr' },
];

const SHEET_OVERLAP = 28;
const ease = { duration: 340, easing: Easing.out(Easing.cubic) };

const clockIn = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function useCurrentPickup() {
  const [pickup, setPickup] = useState<PlaceResult | null>(null);
  const [locating, setLocating] = useState(true);
  const [denied, setDenied] = useState(false);

  const locate = useCallback(async () => {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      setDenied(!granted);
      if (!granted) return;
      setLocating(true);
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 120_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude, longitude } = pos.coords;
      setPickup({ id: 'gps', latitude, longitude, name: 'Current location', detail: 'Finding the street…' });
      const near = await nameForPoint(latitude, longitude).catch(() => null);
      setPickup((p) => (p?.id === 'gps' ? { ...p, detail: near ? `Near ${near}` : '' } : p));
    } catch {
      setDenied(true);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(locate);
  }, [locate]);

  return { pickup, setPickup, locating, denied, locate };
}

function PlaceRow({ icon, place, onPress, index }: {
  icon: AndroidSymbol;
  place: PlaceResult;
  onPress: () => void;
  index: number;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * 35).duration(240)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[place.name, place.detail].filter(Boolean).join(', ')}
        android_ripple={{ color: colors.line }}
        style={styles.placeRow}
      >
        <Pictogram name={icon} size={36} />
        <View style={styles.flex}>
          <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>{place.name}</Text>
          {place.detail ? (
            <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={1}>{place.detail}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function RequestRow({ req, onWithdraw }: { req: MyRequest; onWithdraw: () => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[styles.request, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      <Pictogram name="hourglass_top" size={40} tone="sign" />
      <View style={styles.flex}>
        <Text style={[type.title, type.figure, { color: colors.ink }]} numberOfLines={1}>
          {groupCode(req.rideId)} · leaves {clock(req.leaveAt)}
        </Text>
        <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={2}>
          to {req.destinationName} · waiting for {req.creatorName ?? 'the group'} to accept
        </Text>
      </View>
      <Button
        label="Withdraw"
        variant="text"
        loading={busy}
        onPress={() => {
          setBusy(true);
          Promise.resolve(onWithdraw()).finally(() => setBusy(false));
        }}
      />
    </Animated.View>
  );
}

function LeavingChips({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[type.title, { color: colors.ink }]}>Leaving</Text>
        <Text style={[type.bodySmall, type.figure, { color: colors.muted }]}>
          {value === 0 ? 'Right away' : `around ${clockIn(value)}`}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {LEAVING.map(({ minutes, label }) => {
          const selected = minutes === value;
          return (
            <Pressable
              key={minutes}
              onPress={() => onChange(minutes)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={minutes === 0 ? 'Leave now' : `Leave in ${label}`}
              style={({ pressed }) => [
                styles.chip,
                selected
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: colors.card, borderColor: colors.ink },
                pressed && styles.pressed,
              ]}
            >
              {minutes === 0 ? (
                <Icon name="bolt" size={16} color={selected ? colors.accentInk : colors.ink} />
              ) : null}
              <Text style={[type.label, { color: selected ? colors.accentInk : colors.ink }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const { liveRide } = useMyRides();
  const { requests, withdraw } = useMyRequests();
  const { pickup, setPickup, locating, denied, locate } = useCurrentPickup();

  const [height, setHeight] = useState(0);
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const [leaveIn, setLeaveIn] = useState(0);
  const [recent, setRecent] = useState<PlaceResult[]>([]);

  const [active, setActive] = useState<Field | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [stations, setStations] = useState<PlaceResult[]>([]);
  const [findingStations, setFindingStations] = useState(false);
  const stationsFor = useRef<string | null>(null);

  const mapHeight = Math.round(height * 0.42);
  const collapsedY = mapHeight - SHEET_OVERLAP;
  const sheetY = useSharedValue(0);
  const footer = useSharedValue(1);

  useEffect(() => {
    getRecentDestinations().then(setRecent);
  }, []);

  useEffect(() => {
    sheetY.value = withTiming(active ? insets.top : collapsedY, ease);
    footer.value = withTiming(active ? 0 : 1, ease);
  }, [active, collapsedY, insets.top, sheetY, footer]);

  const close = useCallback(() => {
    Keyboard.dismiss();
    setActive(null);
    setQuery('');
    setResults([]);
    setSearchError(null);
  }, []);

  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [active, close]);

  useEffect(() => {
    const q = query.trim();
    if (!active || q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchPlaces(q, pickup, ctrl.signal)
        .then(setResults)
        .catch(() => !ctrl.signal.aborted && setSearchError('Search is unavailable right now. Try again.'))
        .finally(() => !ctrl.signal.aborted && setSearching(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // Bias by where the rider is, but don't search again just because the street name arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, active, pickup?.latitude, pickup?.longitude]);

  // Suggest the closest stations as soon as the destination search opens; look again only when the pickup moves ~100 m.
  useEffect(() => {
    if (active !== 'destination' || !pickup) return;
    const key = `${pickup.latitude.toFixed(3)},${pickup.longitude.toFixed(3)}`;
    if (stationsFor.current === key) return;
    const ctrl = new AbortController();
    setFindingStations(true);
    nearbyStations(pickup, ctrl.signal)
      .then((found) => {
        stationsFor.current = key;
        setStations(found);
      })
      .catch(() => {})
      .finally(() => !ctrl.signal.aborted && setFindingStations(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pickup?.latitude, pickup?.longitude]);

  const choose = (place: PlaceResult) => {
    if (active === 'pickup') setPickup(place);
    else setDestination(place);
    close();
  };

  const findRiders = async () => {
    if (!pickup || !destination || !inRideRange(pickup, destination)) return;
    // "Current location" means nothing to other riders, so send the street we found for the GPS point.
    const place = ({ id, latitude, longitude, name, detail }: PlaceResult) =>
      JSON.stringify({
        latitude,
        longitude,
        name: id === 'gps' ? (detail.startsWith('Near ') ? detail.slice(5) : 'Pickup point') : name,
      });
    router.push({
      pathname: '/home/groups',
      params: {
        pickup: place(pickup),
        destination: place(destination),
        leaveAt: new Date(Date.now() + leaveIn * 60_000).toISOString(),
        leaveIn: String(leaveIn),
      },
    });
    await saveRecentDestination(destination);
    setRecent(await getRecentDestinations());
  };

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const footerStyle = useAnimatedStyle(() => ({
    opacity: footer.value,
    transform: [{ translateY: (1 - footer.value) * 24 }],
  }));
  const overMapStyle = useAnimatedStyle(() => ({ opacity: footer.value }));

  const pickupLabel = pickup?.name ?? (locating ? 'Finding you…' : 'Set your pickup');
  const pickupDetail = pickup?.detail || (denied && !pickup ? 'Location is off. Search for a place instead.' : '');
  // Station details say "… away" from when they were found; the sign band shows the fresh distance instead.
  const destinationDetail = destination && !destination.detail.endsWith(' away') ? destination.detail : '';
  // How far the destination is from the pickup, worked out fresh so it follows pickup changes.
  const distance = pickup && destination ? distanceBetween(pickup, destination) : null;
  const tooFar = !inRideRange(pickup, destination);
  // when picking one end, only offer places within range of the other end
  const otherEnd = active === 'pickup' ? destination : pickup;
  const shownResults = results.filter((p) => inRideRange(otherEnd, p));
  const nearRecent = recent.filter((p) => inRideRange(pickup, p));

  const renderField = (field: Field) => {
    const editing = active === field;
    const isPickup = field === 'pickup';
    const place = isPickup ? pickup : destination;
    const placeholder = isPickup ? 'Search pickup point' : 'Where are you going?';

    if (editing) {
      return (
        <View style={styles.fieldRow}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={isPickup ? 'Pickup' : 'Destination'}
            returnKeyType="search"
            style={[type.body, styles.input, { color: colors.ink }]}
          />
          {searching && query.trim().length >= 2 ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        </View>
      );
    }

    return (
      <Pressable
        onPress={() => setActive(field)}
        accessibilityRole="button"
        accessibilityLabel={isPickup ? `Pickup: ${pickupLabel}` : destination ? `Destination: ${[destination.name, destinationDetail, distance && `${distance} away`].filter(Boolean).join(', ')}` : placeholder}
        style={styles.fieldRow}
      >
        <View style={styles.flex}>
          {isPickup ? (
            <>
              <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>{pickupLabel}</Text>
              {pickupDetail ? (
                <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={1}>{pickupDetail}</Text>
              ) : null}
            </>
          ) : place ? (
            <>
              <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>{place.name}</Text>
              {destinationDetail ? (
                <Text style={[type.bodySmall, type.figure, { color: colors.muted }]} numberOfLines={1}>{destinationDetail}</Text>
              ) : null}
            </>
          ) : (
            <Text style={[type.body, { color: colors.muted }]}>{placeholder}</Text>
          )}
        </View>
        {isPickup && locating ? <ActivityIndicator size="small" color={colors.muted} /> : null}
      </Pressable>
    );
  };

  const suggestions = () => {
    if (searchError) return <Text style={[type.bodySmall, styles.note, { color: colors.danger }]}>{searchError}</Text>;
    if (query.trim().length >= 2) {
      if (!searching && shownResults.length === 0) {
        return (
          <Text style={[type.bodySmall, styles.note, { color: colors.muted }]}>
            {results.length
              ? `Rides go up to ${MAX_RIDE_KM} km. No places match “${query.trim()}” within ${MAX_RIDE_KM} km of your ${active === 'pickup' ? 'destination' : 'pickup'}.`
              : `No places match “${query.trim()}”.`}
          </Text>
        );
      }
      return shownResults.map((p, i) => <PlaceRow key={p.id} index={i} icon="location_on" place={p} onPress={() => choose(p)} />);
    }
    if (active === 'pickup') {
      return (
        <Animated.View entering={FadeIn.duration(200)}>
          <Pressable
            onPress={() => {
              close();
              locate();
            }}
            accessibilityRole="button"
            android_ripple={{ color: colors.line }}
            style={styles.placeRow}
          >
            <Pictogram name="my_location" size={36} tone="sign" />
            <Text style={[type.title, { color: colors.ink }]}>Use my current location</Text>
          </Pressable>
        </Animated.View>
      );
    }
    return (
      <>
        {nearRecent.length ? (
          <>
            <Text style={[type.label, styles.listLabel, { color: colors.muted }]}>Recent</Text>
            {nearRecent.map((p, i) => (
              <PlaceRow key={p.id} index={i} icon="history" place={p} onPress={() => choose(p)} />
            ))}
          </>
        ) : null}
        {stations.length || findingStations ? (
          <Text style={[type.label, styles.listLabel, { color: colors.muted }]}>Stations near you</Text>
        ) : null}
        {findingStations && !stations.length ? (
          [0, 1, 2].map((i) => <PlaceRowSkeleton key={i} index={i} />)
        ) : (
          stations.map((p, i) => (
            <PlaceRow key={p.id} index={nearRecent.length + i} icon="train" place={p} onPress={() => choose(p)} />
          ))
        )}
      </>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 ? (
        <>
          <View style={{ height: mapHeight }}>
            <RouteMap pickup={pickup} destination={destination} bottomInset={SHEET_OVERLAP} />
            <Animated.View style={[styles.locate, { top: collapsedY - 64 }, overMapStyle]}>
              <Pressable
                onPress={locate}
                accessibilityRole="button"
                accessibilityLabel="Use my current location"
                style={({ pressed }) => [
                  styles.locateButton,
                  { backgroundColor: colors.card, borderColor: colors.line },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="my_location" size={22} color={colors.ink} />
              </Pressable>
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.sheet,
              { height: height - insets.top, backgroundColor: colors.bg, shadowColor: '#000' },
              sheetStyle,
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.line }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetBody, { paddingBottom: active ? 24 : collapsedY + 120 }]}
            >
              <View style={styles.head}>
                <View style={styles.flex}>
                  {!active && me?.firstName ? (
                    <Text style={[type.body, { color: colors.muted }]}>Hi, {me.firstName}</Text>
                  ) : null}
                  <Text style={[active ? type.headline : type.display, { color: colors.ink }]} accessibilityRole="header">
                    {active === 'pickup' ? 'Pickup point' : 'Where to?'}
                  </Text>
                </View>
                {active ? (
                  <Pressable
                    onPress={close}
                    accessibilityRole="button"
                    accessibilityLabel="Close search"
                    style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.card, borderColor: colors.line }, pressed && styles.pressed]}
                  >
                    <Icon name="close" size={20} color={colors.ink} />
                  </Pressable>
                ) : null}
              </View>

              <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <View style={styles.rail} importantForAccessibility="no-hide-descendants">
                  <View style={[styles.railDot, { backgroundColor: colors.accent, borderColor: colors.accentInk }]} />
                  <View style={styles.railDots}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={[styles.railBit, { backgroundColor: colors.muted }]} />
                    ))}
                  </View>
                  <View style={[styles.railSquare, { backgroundColor: colors.coach }]} />
                </View>
                <View style={styles.flex}>
                  {renderField('pickup')}
                  <View style={[styles.divider, { backgroundColor: colors.line }]} />
                  {renderField('destination')}
                </View>
              </View>

              {!active && destination && distance ? (
                <SignBand
                  icon="route"
                  title={`${distance} to ${destination.name}`}
                  detail="We match groups within 1 km of both ends"
                />
              ) : null}

              {active ? (
                <View style={styles.list}>{suggestions()}</View>
              ) : (
                <>
                  {liveRide ? (
                    <View style={styles.section}>
                      <Text style={[type.title, { color: colors.ink }]}>Your ride</Text>
                      <RideCard ride={liveRide} />
                    </View>
                  ) : null}
                  {requests.length ? (
                    <View style={styles.section}>
                      <Text style={[type.title, { color: colors.ink }]}>Waiting to join</Text>
                      {requests.map((r) => (
                        <RequestRow key={r.id} req={r} onWithdraw={() => withdraw(r).catch(() => {})} />
                      ))}
                    </View>
                  ) : null}
                  <LeavingChips value={leaveIn} onChange={setLeaveIn} />
                  <View style={styles.section}>
                    <Text style={[type.title, { color: colors.ink }]}>Recent</Text>
                    {nearRecent.length ? (
                      <View style={styles.list}>
                        {nearRecent.map((p, i) => (
                          <PlaceRow key={p.id} index={i} icon="history" place={p} onPress={() => setDestination(p)} />
                        ))}
                      </View>
                    ) : (
                      <Text style={[type.bodySmall, { color: colors.muted }]}>
                        Places you ride to show up here, so your usual commute is one tap.
                      </Text>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </Animated.View>

          <Animated.View
            pointerEvents={active ? 'none' : 'auto'}
            style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line }, footerStyle]}
          >
            {tooFar ? (
              <Animated.Text
                entering={FadeIn.duration(160)}
                accessibilityLiveRegion="polite"
                style={[type.bodySmall, styles.tooFar, { color: colors.danger }]}
              >
                {distance} is too far. Rides go up to {MAX_RIDE_KM} km, so pick a closer destination.
              </Animated.Text>
            ) : null}
            <Button
              label="Find riders"
              icon="group"
              onPress={findRiders}
              disabled={!pickup || !destination || tooFar}
            />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  tooFar: { marginBottom: 8 },
  locate: { position: 'absolute', right: 16 },
  locateButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 12,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 14, gap: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeButton: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  routeCard: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 12, paddingLeft: 16, paddingRight: 12 },
  rail: { width: 16, alignItems: 'center', paddingVertical: 26, marginRight: 14 },
  railDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  railDots: { flex: 1, justifyContent: 'space-evenly', paddingVertical: 4 },
  railBit: { width: 3, height: 6, borderRadius: 1.5 },
  railSquare: { width: 14, height: 14, borderRadius: 3 },
  fieldRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  input: { flex: 1, paddingVertical: 8 },
  divider: { height: 1 },
  section: { gap: 12 },
  request: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 12, paddingLeft: 12, paddingVertical: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chips: { gap: 8, paddingRight: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  list: { gap: 2, marginHorizontal: -8 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 8, borderRadius: 8 },
  note: { paddingHorizontal: 8, paddingVertical: 12 },
  listLabel: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1 },
});
