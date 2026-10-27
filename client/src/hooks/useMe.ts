import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { apiFetch, ApiError } from '@/services/api';

export type PublicMe = {
  id: string;
  firstName: string | null;
  upiId: string | null;
  photoUrl: string | null;
  idVerified: boolean;
  photoVerified: boolean;
  profileComplete: boolean;
};

export type ProfilePatch = { firstName?: string; upiId?: string };

export function useMe() {
  const { getToken, isSignedIn } = useAuth();
  const [me, setMe] = useState<PublicMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMe(await apiFetch<PublicMe>('/api/me', { token: await getToken() }));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const update = useCallback(
    async (patch: ProfilePatch) => {
      setMe(await apiFetch<PublicMe>('/api/me', { token: await getToken(), method: 'PATCH', body: patch }));
    },
    [getToken],
  );

  useEffect(() => {
    if (isSignedIn) refresh();
  }, [isSignedIn, refresh]);

  return { me, loading, error, refresh, update };
}
