import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoginRequest, SessionResponse, SessionUser } from '@h-os/contracts';
import { ApiError, apiRequest } from './client.js';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

export interface SessionState {
  readonly status: SessionStatus;
  readonly user: SessionUser | null;
  readonly expiresAt: string | null;
  readonly error: unknown;
  readonly signingIn: boolean;
  readonly login: (input: LoginRequest) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly reload: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * One session for the whole shell. The HttpOnly cookie is the only credential; this provider
 * just mirrors the server's answer. A 401 flips the shell to anonymous instead of showing an
 * error page (SEC-009, UX-008).
 */
export function SessionProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [signingIn, setSigningIn] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const current = await apiRequest<SessionUser>('/auth/me');
      if (!mounted.current) return;
      setUser(current);
      setStatus('authenticated');
    } catch (caught) {
      if (!mounted.current) return;
      setUser(null);
      if (caught instanceof ApiError && caught.status === 401) {
        setStatus('anonymous');
      } else {
        setError(caught);
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    // One-time synchronization with the server. Flipping to `loading` synchronously prevents a
    // flash of stale shell content before the session settles (UX-008).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const login = useCallback(async (input: LoginRequest) => {
    setSigningIn(true);
    setError(null);
    try {
      const session = await apiRequest<SessionResponse>('/auth/login', {
        method: 'POST',
        body: input,
      });
      if (!mounted.current) return;
      setUser(session.user);
      setExpiresAt(session.expiresAt);
      setStatus('authenticated');
    } finally {
      if (mounted.current) setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST', expectEmpty: true });
    } finally {
      if (mounted.current) {
        setUser(null);
        setExpiresAt(null);
        setStatus('anonymous');
      }
    }
  }, []);

  const value = useMemo<SessionState>(
    () => ({ status, user, expiresAt, error, signingIn, login, logout, reload }),
    [status, user, expiresAt, error, signingIn, login, logout, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
