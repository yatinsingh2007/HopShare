import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '@/context/AuthContext';
import { ApiError } from '@/services/api';

export type MyRide = {
  id: string;
  pickupName: string;
  destinationName: string;
  leaveAt: string;
  members: number;
  seatsLeft: number;
  isCreator: boolean;
  live: boolean;
};

// Groups I'm in, newest first. Reloads each time the screen comes into view,
// so a group started on the matched-groups screen shows up on the way back.
export function useMyRides() {
  const { isSignedIn, request } = useSession();
  const [rides, setRides] = useState<MyRide[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      request<MyRide[]>('/api/rides/mine')
        .then((found) => {
          setRides(found);
          setError(null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'));
    }, [isSignedIn, request]),
  );

  return { rides, error, liveRide: rides?.find((r) => r.live) ?? null };
}
