import { useEffect, useState } from 'react';
import { useSession } from '@/context/AuthContext';
import { ApiError } from '@/services/api';

export type PublicMe = {
  id: string;
  firstName: string | null;
  email: string | null;
  upiId: string | null;
  profileComplete: boolean;
};

export type ProfilePatch = { firstName: string };

export function useMe() {
  const { isSignedIn, request } = useSession();
  const [me, setMe] = useState<PublicMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    request<PublicMe>('/api/me')
      .then(setMe)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'))
      .finally(() => setLoading(false));
  }, [isSignedIn, request]);

  const update = async (patch: ProfilePatch) => {
    setMe(await request<PublicMe>('/api/me', { method: 'PATCH', body: patch }));
  };

  return { me, loading, error, update };
}
