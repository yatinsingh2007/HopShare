import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, TurboModuleRegistry, View } from 'react-native';
import Animated, {
  cubicBezier,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { WebRouteMap } from '@/components/WebRouteMap';
import { useTheme } from '@/context/ThemeContext';
import type { Place } from '@/services/cabApps';

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
// Until GPS answers, show India rather than the middle of the ocean.
const INDIA: [number, number] = [78.9629, 22.5937];

// Expo Go has no MapLibre native code: there the map is drawn in a WebView instead.
const hasMapLibre = TurboModuleRegistry.get('MLRNCameraModule') != null;
const MapLibre: typeof import('@maplibre/maplibre-react-native') | null = !hasMapLibre
  ? null
  : require('@maplibre/maplibre-react-native'); // eslint-disable-line @typescript-eslint/no-require-imports

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
// markers settle in from slightly above, so a new pick reads as "placed here"
const appear = (fromY: number) =>
  ({
    animationName: {
      from: { opacity: 0, transform: [{ translateY: fromY }, { scale: 0.9 }] },
      to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    },
    animationDuration: '280ms',
    animationTimingFunction: EASE_OUT,
  }) as const;

function Appear({ fromY, children }: { fromY: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  return <Animated.View style={reduced ? null : appear(fromY)}>{children}</Animated.View>;
}

function PickupDot() {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.ring, { backgroundColor: colors.accent }, ring]} />
      <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.accentInk }]} />
    </View>
  );
}

// the drop is the coach chart's maroon square, so it can never be mistaken for the pickup dot
function DropPin() {
  const { colors } = useTheme();
  return (
    <View style={[styles.pin, { backgroundColor: colors.coach, borderColor: colors.coachInk }]}>
      <View style={[styles.pinCore, { backgroundColor: colors.coachInk }]} />
    </View>
  );
}

// someone else's stop (a rider asking to join): an outlined maroon square, so it reads as "not ours yet"
function ExtraPin() {
  const { colors } = useTheme();
  return <View style={[styles.extra, { borderColor: colors.coach, backgroundColor: colors.card }]} />;
}

export function RouteMap({ pickup, destination, extra, bottomInset }: {
  pickup: Place | null;
  destination: Place | null;
  /** An extra stop to show and fit in view, e.g. a requester's drop. */
  extra?: Place | null;
  /** Height of whatever covers the bottom of the map, so the route stays in the visible part. */
  bottomInset: number;
}) {
  const { colors, scheme } = useTheme();
  const camera = useRef<CameraRef>(null);

  useEffect(() => {
    const padding = { top: 90, left: 56, right: 56, bottom: bottomInset + 48 };
    if (pickup && destination) {
      const points = extra ? [pickup, destination, extra] : [pickup, destination];
      const lngs = points.map((p) => p.longitude);
      const lats = points.map((p) => p.latitude);
      camera.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], {
        padding,
        duration: 900,
      });
    } else if (pickup || destination) {
      const p = (pickup ?? destination)!;
      camera.current?.flyTo({ center: [p.longitude, p.latitude], zoom: 15, padding, duration: 1400 });
    }
  }, [pickup, destination, extra, bottomInset]);

  const route = useMemo<GeoJSON.Feature | null>(
    () =>
      pickup && destination
        ? {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [pickup.longitude, pickup.latitude],
                [destination.longitude, destination.latitude],
              ],
            },
          }
        : null,
    [pickup, destination],
  );

  if (!MapLibre) return <WebRouteMap pickup={pickup} destination={destination} bottomInset={bottomInset} />;
  const { Camera, GeoJSONSource, Layer, Map, Marker } = MapLibre;

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={STYLES[scheme]}
      logo={false}
      compass={false}
      attributionPosition={{ top: 8, right: 8 }}
      touchPitch={false}
      touchRotate={false}
    >
      <Camera ref={camera} initialViewState={{ center: INDIA, zoom: 3.6 }} />
      {route ? (
        <GeoJSONSource id="route" data={route}>
          {/* the route is drawn like rail track: a pale bed under a solid maroon line */}
          <Layer
            id="route-casing"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.card, 'line-width': 9 }}
          />
          <Layer
            id="route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.route, 'line-width': 5 }}
          />
        </GeoJSONSource>
      ) : null}
      {pickup ? (
        <Marker id="pickup" lngLat={[pickup.longitude, pickup.latitude]} anchor="center">
          <Appear key={`${pickup.longitude},${pickup.latitude}`} fromY={-6}>
            <PickupDot />
          </Appear>
        </Marker>
      ) : null}
      {extra ? (
        <Marker id="extra" lngLat={[extra.longitude, extra.latitude]} anchor="center">
          <Appear key={`${extra.longitude},${extra.latitude}`} fromY={-8}>
            <ExtraPin />
          </Appear>
        </Marker>
      ) : null}
      {destination ? (
        <Marker id="destination" lngLat={[destination.longitude, destination.latitude]} anchor="center">
          <Appear key={`${destination.longitude},${destination.latitude}`} fromY={-8}>
            <DropPin />
          </Appear>
        </Marker>
      ) : null}
    </Map>
  );
}

const styles = StyleSheet.create({
  dotWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 18, height: 18, borderRadius: 9 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  pin: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pinCore: { width: 6, height: 6, borderRadius: 1 },
  extra: { width: 20, height: 20, borderRadius: 4, borderWidth: 3, borderStyle: 'dashed' },
});
