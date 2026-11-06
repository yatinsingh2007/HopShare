import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, ApiError } from '@/services/api';

type Tokens = { accessToken: string; refreshToken: string };
type RequestOptions = { method?: string; body?: unknown };

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  signIn: (clerkToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

const KEY = 'hopshare.tokens';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const tokens = useRef<Tokens | null>(null);
  const refreshing = useRef<Promise<Tokens | null> | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        tokens.current = saved ? JSON.parse(saved) : null;
        setIsSignedIn(!!tokens.current);
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const save = useCallback(async (next: Tokens | null) => {
    tokens.current = next;
    setIsSignedIn(!!next);
    if (next) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(KEY);
  }, []);

  // only one refresh at a time: the server ends the session if the same refresh token is used twice
  const refresh = useCallback(() => {
    refreshing.current ??= apiFetch<Tokens>('/api/auth/refresh', {
      token: null,
      method: 'POST',
      body: { refreshToken: tokens.current?.refreshToken },
    })
      .then(async (next) => {
        await save(next);
        return next;
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
        return await apiFetch<T>(path, { token: tokens.current?.accessToken ?? null, method, body });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        const next = await refresh();
        if (!next) throw e;
        return apiFetch<T>(path, { token: next.accessToken, method, body });
      }
    },
    [refresh],
  );

  const signIn = useCallback(
    async (clerkToken: string) => {
      const data = await apiFetch<Tokens>('/api/auth/login', { token: null, method: 'POST', body: { clerkToken } });
      await save({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
    [save],
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokens.current?.refreshToken;
    await save(null);
    apiFetch('/api/auth/logout', { token: null, method: 'POST', body: { refreshToken } }).catch(() => {});
  }, [save]);

  const value = useMemo(
    () => ({ isLoaded, isSignedIn, signIn, signOut, request }),
    [isLoaded, isSignedIn, signIn, signOut, request],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useSession must be used inside AuthProvider');
  return value;
}
