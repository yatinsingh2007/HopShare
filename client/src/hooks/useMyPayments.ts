import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '@/context/AuthContext';
import { useSocketEvent } from '@/context/SocketContext';
import { ApiError } from '@/services/api';

type Base = {
  id: string;
  rideId: string;
  destinationName: string;
  endedAt: string | null;
  amountPaise: number;
  status: 'PENDING' | 'PAID';
  claimedAt: string | null;
};
export type Owe = Base & { toName: string | null; toUpiId: string | null };
export type Owed = Base & { fromName: string | null };

// Everything I owe bookers and everything riders owe me, across rides.
export function useMyPayments() {
  const { isSignedIn, request } = useSession();
  const [data, setData] = useState<{ owe: Owe[]; owed: Owed[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setData(await request<{ owe: Owe[]; owed: Owed[] }>('/api/me/payments'));
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
  useSocketEvent('payment:due', reload);
  useSocketEvent('payment:claimed', reload);
  useSocketEvent('payment:confirmed', reload);

  // returns an error message, or null when done
  const act = useCallback(
    async (p: Base, kind: 'claim' | 'confirm') => {
      try {
        await request(`/api/rides/${p.rideId}/payments/${p.id}/${kind}`, { method: 'POST' });
        await reload();
        return null;
      } catch (e) {
        return e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      }
    },
    [request, reload],
  );

  return { data, error, reload, act };
}
