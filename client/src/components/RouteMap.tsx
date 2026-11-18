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

function DropPin() {
  const { colors } = useTheme();
  return (
    <View style={[styles.pin, { backgroundColor: colors.ink }]}>
      <View style={[styles.pinCore, { backgroundColor: colors.accent }]} />
    </View>
  );
}

export function RouteMap({ pickup, destination, bottomInset }: {
  pickup: Place | null;
  destination: Place | null;
  /** Height of whatever covers the bottom of the map, so the route stays in the visible part. */
  bottomInset: number;
}) {
  const { colors, scheme } = useTheme();
  const camera = useRef<CameraRef>(null);

  useEffect(() => {
    const padding = { top: 90, left: 56, right: 56, bottom: bottomInset + 48 };
    if (pickup && destination) {
      const lngs = [pickup.longitude, destination.longitude];
      const lats = [pickup.latitude, destination.latitude];
      camera.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], {
        padding,
        duration: 900,
      });
    } else if (pickup || destination) {
      const p = (pickup ?? destination)!;
      camera.current?.flyTo({ center: [p.longitude, p.latitude], zoom: 15, padding, duration: 1400 });
    }
  }, [pickup, destination, bottomInset]);

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
          <Layer
            id="route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.ink, 'line-width': 3, 'line-dasharray': [0.1, 2] }}
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
      {destination ? (
        <Marker id="destination" lngLat={[destination.longitude, destination.latitude]} anchor="bottom">
          <Appear key={`${destination.longitude},${destination.latitude}`} fromY={-14}>
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
    width: 26,
    height: 26,
    borderRadius: 13,
    borderBottomRightRadius: 3,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pinCore: { width: 9, height: 9, borderRadius: 4.5 },
});
