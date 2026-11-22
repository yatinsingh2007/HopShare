import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '@/context/AuthContext';
import { useSocketEvent } from '@/context/SocketContext';
import { ApiError } from '@/services/api';

export type ActivityItem = {
  id: string;
  kind: string;
  rideId: string | null;
  text: string;
  createdAt: string;
  readAt: string | null;
};

// The Activity feed and its unread count; reloads on focus and whenever the server logs something new.
export function useActivity() {
  const { isSignedIn, request } = useSession();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const data = await request<{ items: ActivityItem[]; unread: number }>('/api/me/activity');
      setItems(data.items);
      setUnread(data.unread);
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
  useSocketEvent('activity:new', reload);

  const markRead = useCallback(async () => {
    setUnread(0);
    await request('/api/me/activity/read', { method: 'POST' }).catch(() => {});
  }, [request]);

  return { items, unread, error, reload, markRead };
}
