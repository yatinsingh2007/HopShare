import { Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';
import type { Place } from '@/services/cabApps';

type Notifications = typeof NotificationsModule;

// Loaded on first use, not at import: an app build made before expo-notifications was added has no
// native side for it, and importing it there throws "Cannot find native module" on every launch.
let loaded: Notifications | null | undefined;
function notifications(): Notifications | null {
  if (loaded !== undefined) return loaded;
  try {
    loaded = require('expo-notifications') as Notifications; // eslint-disable-line @typescript-eslint/no-require-imports
    // show our notifications even while the app is open
    loaded.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    loaded = null;
  }
  return loaded;
}

const CHANNEL = 'rides';

async function canNotify(n: Notifications) {
  if (Platform.OS === 'android') {
    await n.setNotificationChannelAsync(CHANNEL, {
      name: 'Your rides',
      description: 'When your group goes live and when riders join.',
      importance: n.AndroidImportance.HIGH,
      lightColor: '#FFCC00',
    });
  }
  const { granted, canAskAgain } = await n.getPermissionsAsync();
  if (granted) return true;
  if (!canAskAgain) return false;
  return (await n.requestPermissionsAsync()).granted;
}

// A local notification (nothing goes through a push server). Quietly does nothing if notifications are off
// or this build of the app doesn't include them.
export async function notifyRideLive(pickup: Place, destination: Place, leaveAt: string) {
  try {
    const n = notifications();
    if (!n || !(await canNotify(n))) return;
    const time = new Date(leaveAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    await n.scheduleNotificationAsync({
      content: {
        title: 'Your ride is live',
        body: `${pickup.name} → ${destination.name} · leaves ${time}. Riders going your way can now find it.`,
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
  } catch {
    // a missing notification must never break starting a group
  }
}
