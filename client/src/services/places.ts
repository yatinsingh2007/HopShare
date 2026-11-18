import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from '@/services/cabApps';

// Photon (OpenStreetMap data, free, no key). Planned to move behind our server as /api/places.
const PHOTON = 'https://photon.komoot.io';
const RECENT_KEY = 'hopshare.recentDestinations';

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
  const res = await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=6&lang=en${bias}`, { signal });
  if (!res.ok) throw new Error('Search is unavailable right now.');
  const { features } = (await res.json()) as { features: PhotonFeature[] };
  return features.map(toResult);
}

export async function nameForPoint(latitude: number, longitude: number) {
  const res = await fetch(`${PHOTON}/reverse?lat=${latitude}&lon=${longitude}&limit=1&lang=en`);
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
