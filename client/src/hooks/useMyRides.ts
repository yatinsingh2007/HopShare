import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '@/context/AuthContext';
import { useSocketEvent } from '@/context/SocketContext';
import { ApiError } from '@/services/api';

export type RideStage = 'open' | 'booked' | 'picked_up' | 'ended' | 'cancelled' | 'past';
export type MyRide = {
  id: string;
  pickupName: string;
  destinationName: string;
  leaveAt: string;
  members: number;
  seatsLeft: number;
  isCreator: boolean;
  live: boolean;
  stage: RideStage;
  farePaise: number | null;
  settled: boolean;
  /** My share, if I owe the booker. */
  myShare: { amountPaise: number; status: 'PENDING' | 'PAID' } | null;
};

// Groups I'm in, newest first. Reloads each time the screen comes into view
// and when the server says something changed (accepted, cab booked, fare in).
export function useMyRides() {
  const { isSignedIn, request } = useSession();
  const [rides, setRides] = useState<MyRide[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setRides(await request<MyRide[]>('/api/rides/mine'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [isSignedIn, request]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useSocketEvent('request:answered', reload);
  useSocketEvent('payment:due', reload);
  useSocketEvent('ride:cancelled', reload);

  return { rides, error, reload, liveRide: rides?.find((r) => r.live) ?? null };
}
