import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { requestPermissionAndGetToken } from '@/components/Notification';
import { apiFetch, ApiError } from '@/services/api';

type RequestOptions = { method?: string; body?: unknown };
type SignInPath = '/api/auth/login' | '/api/auth/set-password' | '/api/auth/clerk';

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  signIn: (path: SignInPath, body: object) => Promise<void>;
  signOut: () => Promise<void>;
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
  /** For the socket handshake, which sends the same access token. */
  getAccessToken: () => string | null;
  /** A new access token, or null if signed out. */
  refreshAccessToken: () => Promise<string | null>;
};

// Only the access token is kept here. The refresh token is an httpOnly cookie the phone's
// cookie store sends to /api/auth by itself, so the app never handles it.
const KEY = 'hopshare.accessToken';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const accessToken = useRef<string | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        accessToken.current = saved;
        setIsSignedIn(!!saved);
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const save = useCallback(async (next: string | null) => {
    accessToken.current = next;
    setIsSignedIn(!!next);
    if (next) await AsyncStorage.setItem(KEY, next);
    else await AsyncStorage.removeItem(KEY);
  }, []);

  // only one refresh at a time, so parallel 401s share one new token instead of racing
  const refresh = useCallback(() => {
    refreshing.current ??= apiFetch<{ accessToken: string }>('/api/auth/refresh', { token: null, method: 'POST' })
      .then(async (data) => {
        await save(data.accessToken);
        return data.accessToken;
      })
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 401) await save(null);
        return null;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [save]);

  const request = useCallback(
    async <T,>(path: string, { method, body }: RequestOptions = {}) => {
      try {
        return await apiFetch<T>(path, { token: accessToken.current, method, body });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        const next = await refresh();
        if (!next) throw e;
        return apiFetch<T>(path, { token: next, method, body });
      }
    },
    [refresh],
  );

  // every way in (password, email code + new password, Google) ends with our access token
  const signIn = useCallback(
    async (path: SignInPath, body: object) => {
      const data = await apiFetch<{ accessToken: string }>(path, { token: null, method: 'POST', body });
      await save(data.accessToken);
    },
    [save],
  );

  // While signed in, the server keeps this phone's FCM token so it can push when the app is closed
  useEffect(() => {
    if (!isSignedIn) return;
    const saveToken = (fcmToken: string) => request('/api/me', { method: 'PATCH', body: { fcmToken } }).catch(() => {});
    requestPermissionAndGetToken()
      .then((token) => token !== 'Permission denied' && saveToken(token))
      .catch(() => {});
    return messaging().onTokenRefresh(saveToken);
  }, [isSignedIn, request]);

  // drop the push token, then log out first, so its "clear cookie" reply can't land after a new sign-in
  const signOut = useCallback(async () => {
    await request('/api/me', { method: 'PATCH', body: { fcmToken: null } }).catch(() => {});
    await apiFetch('/api/auth/logout', { token: null, method: 'POST' }).catch(() => {});
    await save(null);
  }, [save, request]);

  const getAccessToken = useCallback(() => accessToken.current, []);

  const value = useMemo(
    () => ({ isLoaded, isSignedIn, signIn, signOut, request, getAccessToken, refreshAccessToken: refresh }),
    [isLoaded, isSignedIn, signIn, signOut, request, getAccessToken, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useSession must be used inside AuthProvider');
  return value;
}
