import {
  authResponseSchema,
  userSchema,
  type AuthResponse,
  type ConsentInput,
  type LoginInput,
  type RegisterInput,
  type User,
} from '@ai-coach/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../../lib/api.js';
import { LOGOUT_EVENT, readSession, writeSession, type Session } from '../../lib/session.js';

interface AuthState {
  session: Session | null;
  user: User | undefined;
  loadingUser: boolean;
  login(input: LoginInput): Promise<User>;
  register(input: RegisterInput): Promise<User>;
  giveConsent(input: ConsentInput): Promise<User>;
  refreshUser(): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthState | null>(null);
const ME = ['me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(() => readSession());

  const me = useQuery({
    queryKey: ME,
    queryFn: ({ signal }) => api('/api/auth/me', { schema: userSchema, signal }),
    enabled: session !== null,
    staleTime: 60_000,
    retry: false,
  });

  const logout = useCallback(() => {
    writeSession(null);
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  // The API client fires this when the server rejects the stored token.
  useEffect(() => {
    window.addEventListener(LOGOUT_EVENT, logout);
    return () => window.removeEventListener(LOGOUT_EVENT, logout);
  }, [logout]);

  // Sign out exactly when the token expires instead of waiting for the next failed request.
  useEffect(() => {
    if (!session) return;
    const ms = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(logout, Math.max(ms, 0));
    return () => clearTimeout(timer);
  }, [session, logout]);

  const start = useCallback(
    (res: AuthResponse) => {
      const next = { token: res.token, expiresAt: res.expiresAt };
      writeSession(next);
      setSession(next);
      queryClient.setQueryData(ME, res.user);
      return res.user;
    },
    [queryClient],
  );

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: me.data,
      loadingUser: session !== null && me.isPending,
      login: async (input) =>
        start(
          await api('/api/auth/login', { method: 'POST', body: input, schema: authResponseSchema }),
        ),
      register: async (input) =>
        start(
          await api('/api/auth/register', {
            method: 'POST',
            body: input,
            schema: authResponseSchema,
          }),
        ),
      giveConsent: async (input) => {
        const user = await api('/api/me/consent', {
          method: 'PUT',
          body: input,
          schema: userSchema,
        });
        queryClient.setQueryData(ME, user);
        return user;
      },
      refreshUser: () => queryClient.invalidateQueries({ queryKey: ME }),
      logout,
    }),
    [session, me.data, me.isPending, start, logout, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
