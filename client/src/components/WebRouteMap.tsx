import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/context/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';
import type { Place } from '@/services/cabApps';

// Same map as RouteMap, drawn with MapLibre GL JS in a WebView. Used where the native map
// isn't in the app (Expo Go).
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const page = (styleUrl: string, c: ColorTokens) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet">
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; background: ${c.card}; }
  .dot { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
  .dot i { position: absolute; width: 18px; height: 18px; border-radius: 9px; background: ${c.accent};
    animation: pulse 1.8s cubic-bezier(.5,1,.89,1) infinite; }
  .dot b { width: 12px; height: 12px; border-radius: 9px; background: ${c.accent}; border: 3px solid ${c.accentInk}; }
  @keyframes pulse { from { transform: scale(1); opacity: .55; } to { transform: scale(2.6); opacity: 0; } }
  .pin { width: 22px; height: 22px; border-radius: 4px; background: ${c.coach}; border: 3px solid ${c.coachInk};
    display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
  .pin b { width: 6px; height: 6px; border-radius: 1px; background: ${c.coachInk}; }
  .maplibregl-ctrl-attrib { font-size: 10px; }
  /* markers settle in from slightly above, so a new pick reads as "placed here" */
  .appear { animation: appear 280ms cubic-bezier(.23,1,.32,1) both; }
  .appear.drop { --from: -14px; }
  @keyframes appear {
    from { opacity: 0; transform: translateY(var(--from, -6px)) scale(.9); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) { .appear, .dot i { animation: none; } }
</style>
</head><body><div id="map"></div><script>
  var map = new maplibregl.Map({
    container: 'map', style: '${styleUrl}', center: [78.9629, 22.5937], zoom: 3.6,
    attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();

  function marker(cls, anchor) {
    var el = document.createElement('div');
    el.innerHTML = cls === 'dot'
      ? '<div class="appear"><div class="dot"><i></i><b></b></div></div>'
      : '<div class="appear drop"><div class="pin"><b></b></div></div>';
    var m = new maplibregl.Marker({ element: el, anchor: anchor });
    m.appear = el.firstChild;
    return m;
  }
  var pickupMarker = marker('dot', 'center');
  var dropMarker = marker('pin', 'center');
  var loaded = false, latest = null, lastRoute = null;

  // hide the line instantly, then fade it in over 400ms
  function fadeInRoute() {
    map.setPaintProperty('route-line', 'line-opacity-transition', { duration: 0, delay: 0 });
    map.setPaintProperty('route-line', 'line-opacity', 0);
    requestAnimationFrame(function () {
      map.setPaintProperty('route-line', 'line-opacity-transition', { duration: 400, delay: 150 });
      map.setPaintProperty('route-line', 'line-opacity', 1);
    });
  }
  var empty = { type: 'FeatureCollection', features: [] };

  // replay the entrance whenever the marker moves to a new place
  function place(m, p) {
    var key = p ? p.longitude + ',' + p.latitude : null;
    if (key === m.key) return;
    m.key = key;
    if (!p) return m.remove();
    m.setLngLat([p.longitude, p.latitude]).addTo(map);
    m.appear.style.animation = 'none';
    void m.appear.offsetWidth;
    m.appear.style.animation = '';
  }

  function draw(s) {
    var p = s.pickup, d = s.destination;
    var padding = { top: 90, left: 56, right: 56, bottom: s.bottomInset + 48 };
    place(pickupMarker, p);
    place(dropMarker, d);
    var routeKey = p && d ? pickupMarker.key + '>' + dropMarker.key : null;
    if (routeKey !== lastRoute) {
      lastRoute = routeKey;
      fadeInRoute();
    }
    map.getSource('route').setData(p && d ? {
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: [[p.longitude, p.latitude], [d.longitude, d.latitude]] },
    } : empty);
    if (p && d) {
      map.fitBounds([
        [Math.min(p.longitude, d.longitude), Math.min(p.latitude, d.latitude)],
        [Math.max(p.longitude, d.longitude), Math.max(p.latitude, d.latitude)],
      ], { padding: padding, duration: 900 });
    } else if (p || d) {
      var q = p || d;
      map.flyTo({ center: [q.longitude, q.latitude], zoom: 15, padding: padding, duration: 1400 });
    }
  }

  window.setRoute = function (s) { latest = s; if (loaded) draw(s); };

  map.on('load', function () {
    map.addSource('route', { type: 'geojson', data: empty });
    map.addLayer({
      id: 'route-casing', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '${c.card}', 'line-width': 9 },
    });
    map.addLayer({
      id: 'route-line', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '${c.route}', 'line-width': 5 },
    });
    loaded = true;
    if (latest) draw(latest);
  });
</script></body></html>`;

export function WebRouteMap({ pickup, destination, bottomInset }: {
  pickup: Place | null;
  destination: Place | null;
  bottomInset: number;
}) {
  const { colors, scheme } = useTheme();
  const web = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const source = useMemo(() => ({ html: page(STYLES[scheme], colors) }), [scheme, colors]);

  useEffect(() => {
    if (!ready) return;
    const state = JSON.stringify({ pickup, destination, bottomInset });
    web.current?.injectJavaScript(`window.setRoute(${state}); true;`);
  }, [ready, pickup, destination, bottomInset]);

  return (
    <WebView<object>
      ref={web}
      source={source}
      originWhitelist={['*']}
      onLoadStart={() => setReady(false)}
      onLoadEnd={() => setReady(true)}
      scrollEnabled={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
    />
  );
}
