import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useSocket } from '@/context/SocketContext';

export type RiderPosition = { userId: string; latitude: number; longitude: number; at: number };
type WatchAck = { ok: boolean; positions?: RiderPosition[] };

const STALE_MS = 60_000;

/**
 * Keeps this phone in the ride's socket room (so `ride:updated` arrives) and, while `share` is on,
 * sends this phone's position every few seconds. Returns the others' latest positions,
 * dropping anyone not heard from in a minute.
 */
export function useLiveRide(rideId: string, share: boolean) {
  const socket = useSocket();
  const [positions, setPositions] = useState<Record<string, RiderPosition>>({});

  // join the room now and after every reconnect (rooms don't survive a reconnect)
  useEffect(() => {
    if (!socket) return;
    const watch = () =>
      socket.emit('ride:watch', { rideId }, (ack: WatchAck) => {
        if (ack?.ok && ack.positions) setPositions(Object.fromEntries(ack.positions.map((p) => [p.userId, p])));
      });
    const onUpdate = (p: RiderPosition) => setPositions((all) => ({ ...all, [p.userId]: p }));

    if (socket.connected) watch();
    socket.on('connect', watch);
    socket.on('location:update', onUpdate);
    return () => {
      socket.off('connect', watch);
      socket.off('location:update', onUpdate);
      socket.emit('ride:unwatch', { rideId });
    };
  }, [socket, rideId]);

  // forget riders who stopped sending
  useEffect(() => {
    const t = setInterval(() => {
      setPositions((all) => {
        const now = Date.now();
        const kept = Object.values(all).filter((p) => now - p.at < STALE_MS);
        return kept.length === Object.keys(all).length ? all : Object.fromEntries(kept.map((p) => [p.userId, p]));
      });
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  // send my position while sharing; the server ignores it outside the sharing window anyway
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!socket || !share) return;
    let sub: Location.LocationSubscription | null = null;
    let stopped = false;
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      setDenied(!granted);
      if (!granted || stopped) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 5 },
        ({ coords }) => socket.emit('location:update', { rideId, latitude: coords.latitude, longitude: coords.longitude }),
      );
      if (stopped) sub.remove();
    })().catch(() => {});
    return () => {
      stopped = true;
      sub?.remove();
    };
  }, [socket, rideId, share]);

  return { positions, denied };
}
