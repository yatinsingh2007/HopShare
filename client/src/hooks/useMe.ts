import { useEffect, useState } from 'react';
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

/** Loads the signed-in rider's profile from our API. */
export function useMe() {
  const { getToken, isSignedIn } = useAuth();
  const [me, setMe] = useState<PublicMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    const load = async () => {
      try {
        setMe(await apiFetch<PublicMe>('/api/me', { token: await getToken() }));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isSignedIn, getToken]);

  const update = async (patch: ProfilePatch) => {
    setMe(await apiFetch<PublicMe>('/api/me', { token: await getToken(), method: 'PATCH', body: patch }));
  };

  return { me, loading, error, update };
}
