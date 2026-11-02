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
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const fetchMe = useCallback(
    async () => apiFetch<PublicMe>('/api/me', { token: await getToken() }),
    [getToken],
  );

  const applyResult = useCallback((result: Promise<PublicMe>, isCurrent: () => boolean = () => true) => {
    return result
      .then((data) => {
        if (!isCurrent()) return;
        setMe(data);
        setError(null);
        setErrorStatus(null);
      })
      .catch((e) => {
        if (!isCurrent()) return;
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
        setErrorStatus(e instanceof ApiError ? e.status : null);
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await applyResult(fetchMe());
  }, [applyResult, fetchMe]);

  const update = useCallback(
    async (patch: ProfilePatch) => {
      setMe(await apiFetch<PublicMe>('/api/me', { token: await getToken(), method: 'PATCH', body: patch }));
    },
    [getToken],
  );

  useEffect(() => {
    if (!isSignedIn) return;
    let current = true;
    applyResult(fetchMe(), () => current);
    return () => {
      current = false;
    };
  }, [isSignedIn, applyResult, fetchMe]);

  return { me, loading, error, errorStatus, refresh, update };
}
