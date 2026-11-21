import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from '@/services/cabApps';

// Photon (OpenStreetMap data, free, no key). Planned to move behind our server as /api/places.
const PHOTON = 'https://photon.komoot.io';
const RECENT_KEY = 'hopshare.recentDestinations';
// Photon's server refuses (403) Android's default okhttp User-Agent, so name the app instead.
const PHOTON_HEADERS = { 'User-Agent': 'HopShare/1.0 (Android app)' };

export type PlaceResult = Place & { id: string; detail: string };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
  };
};

const toResult = ({ geometry, properties: p }: PhotonFeature): PlaceResult => {
  const [longitude, latitude] = geometry.coordinates;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const name = p.name || street || p.locality || p.city || 'Dropped pin';
  const detail = [p.name ? street : '', p.locality || p.district, p.city, p.state]
    .filter((part, i, all) => part && part !== name && all.indexOf(part) === i)
    .join(', ');
  return { id: `${p.osm_id ?? ''}:${longitude},${latitude}`, latitude, longitude, name, detail };
};

export async function searchPlaces(q: string, near: Place | null, signal?: AbortSignal) {
  const bias = near ? `&lat=${near.latitude}&lon=${near.longitude}` : '';
  const res = await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=6&lang=en${bias}`, { signal, headers: PHOTON_HEADERS });
  if (!res.ok) throw new Error('Search is unavailable right now.');
  const { features } = (await res.json()) as { features: PhotonFeature[] };
  return features.map(toResult);
}

// Photon can't list "what's near me" without a search word, so ask for a few rail words inside a box
// around the point, then keep the closest. Metro gates and lifts are folded into their station.
const STATION_TAGS = ['railway:station', 'railway:halt', 'railway:subway_entrance'].map((t) => `&osm_tag=${t}`).join('');
const STATION_WORDS = ['station', 'metro', 'junction'];
const stationName = (name: string) => name.replace(/\s*(metro\s+)?(station\s+)?(gate|exit|entry|entrance|lift)\b.*$/i, '').trim();

const kmBetween = (a: Place, b: Place) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// Straight-line distance as "850 m" or "3.4 km".
const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
export const distanceBetween = (a: Place, b: Place) => formatKm(kmBetween(a, b));

async function stationsAround(near: Place, delta: number, signal?: AbortSignal) {
  const { latitude: lat, longitude: lon } = near;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const pages = await Promise.all(
    STATION_WORDS.map(async (word) => {
      const res = await fetch(`${PHOTON}/api/?q=${word}&bbox=${bbox}&limit=30&lang=en${STATION_TAGS}`, { signal, headers: PHOTON_HEADERS });
      if (!res.ok) return [];
      return ((await res.json()) as { features: PhotonFeature[] }).features;
    }),
  );

  const closest = new Map<string, { place: PlaceResult; km: number }>();
  for (const feature of pages.flat()) {
    const place = toResult(feature);
    const name = stationName(place.name);
    if (!name) continue;
    const km = kmBetween(near, place);
    if ((closest.get(name)?.km ?? Infinity) > km) closest.set(name, { place: { ...place, name }, km });
  }
  return [...closest.values()]
    .sort((a, b) => a.km - b.km)
    .map(({ place, km }) => ({ ...place, detail: `${formatKm(km)} away` }));
}

// The nearest metro and railway stations: about 4 km around, or about 10 km if that finds too few.
export async function nearbyStations(near: Place, signal?: AbortSignal) {
  let found = await stationsAround(near, 0.04, signal);
  if (found.length < 3) found = await stationsAround(near, 0.1, signal);
  return found.slice(0, 5);
}

export async function nameForPoint(latitude: number, longitude: number) {
  const res = await fetch(`${PHOTON}/reverse?lat=${latitude}&lon=${longitude}&limit=1&lang=en`, { headers: PHOTON_HEADERS });
  const { features } = (await res.json()) as { features: PhotonFeature[] };
  return features[0] ? toResult(features[0]).name : null;
}

export async function getRecentDestinations(): Promise<PlaceResult[]> {
  const saved = await AsyncStorage.getItem(RECENT_KEY).catch(() => null);
  return saved ? JSON.parse(saved) : [];
}

export async function saveRecentDestination(place: PlaceResult) {
  const recent = (await getRecentDestinations()).filter((p) => p.id !== place.id);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([place, ...recent].slice(0, 5)));
}
