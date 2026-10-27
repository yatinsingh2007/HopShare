import { createContext, useContext, type ReactNode } from 'react';
import { useMe } from '@/hooks/useMe';

type MeContextValue = ReturnType<typeof useMe>;
const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  return <MeContext.Provider value={useMe()}>{children}</MeContext.Provider>;
}

export function useMeContext() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMeContext must be used inside MeProvider');
  return ctx;
}
