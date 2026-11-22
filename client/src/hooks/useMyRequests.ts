import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '@/context/AuthContext';
import { useSocketEvent } from '@/context/SocketContext';
import { ApiError } from '@/services/api';

export type MyRequest = {
  id: string;
  rideId: string;
  pickupName: string;
  destinationName: string;
  leaveAt: string;
  creatorName: string | null;
  members: number;
};

// My asks to join that are still waiting. Reloads whenever the screen comes into view;
// an accepted one disappears from here and shows up as my ride instead.
export function useMyRequests() {
  const { isSignedIn, request } = useSession();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!isSignedIn) return;
    request<MyRequest[]>('/api/rides/requests/mine')
      .then((found) => {
        setRequests(found);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'));
  }, [isSignedIn, request]);

  useFocusEffect(reload);
  // accepted, declined, or closed because the group filled up or booked its cab
  useSocketEvent('request:answered', reload);

  const withdraw = useCallback(
    async (r: MyRequest) => {
      await request(`/api/rides/${r.rideId}/requests/${r.id}/cancel`, { method: 'POST' });
      setRequests((all) => all.filter((x) => x.id !== r.id));
    },
    [request],
  );

  return { requests, error, reload, withdraw };
}
