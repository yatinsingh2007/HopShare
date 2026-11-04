import { Linking } from 'react-native';

export type Place = { latitude: number; longitude: number; name: string };

const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

/** Tries the app link first; if the app isn't installed, opens the web fallback instead. */
const openWithFallback = async (appUrl: string, webUrl: string) => {
  try {
    await Linking.openURL(appUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
};

/**
 * Opens Uber with pickup and drop filled in.
 * https://developer.uber.com/docs/deep-linking-action-setpickup
 */
export const bookOnUber = (pickup: Place, drop: Place) => {
  const appUrl =
    'uber://riderequest?' +
    query({
      'pickup[latitude]': pickup.latitude,
      'pickup[longitude]': pickup.longitude,
      'pickup[nickname]': pickup.name,
      'dropoff[latitude]': drop.latitude,
      'dropoff[longitude]': drop.longitude,
      'dropoff[nickname]': drop.name,
    });
  // Universal link: opens Uber if installed, otherwise the Play Store / App Store.
  const place = (p: Place) => JSON.stringify({ latitude: p.latitude, longitude: p.longitude, addressLine1: p.name });
  const webUrl = 'https://m.uber.com/looking?' + query({ pickup: place(pickup), 'drop[0]': place(drop) });
  return openWithFallback(appUrl, webUrl);
};

/**
 * Opens Ola with pickup and drop filled in.
 * https://developers.olacabs.com/docs/deep-linking
 * Ola asks for a `utm_source` token from its developer programme; it's sent when set.
 */
export const bookOnOla = (pickup: Place, drop: Place) => {
  const params = {
    lat: pickup.latitude,
    lng: pickup.longitude,
    drop_lat: drop.latitude,
    drop_lng: drop.longitude,
    utm_source: process.env.EXPO_PUBLIC_OLA_UTM_SOURCE,
  };
  const appUrl = 'olacabs://app/launch?' + query({ ...params, address: pickup.name, drop_address: drop.name, landing_page: 'bk' });
  const webUrl = 'https://book.olacabs.com/?' + query({ ...params, pickup_name: pickup.name, drop_name: drop.name });
  return openWithFallback(appUrl, webUrl);
};
