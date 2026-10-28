/**
 * The JWT lives in localStorage so a reload keeps the user signed in. Tokens are short-lived
 * (JWT_TTL_MINUTES) and an expired one is dropped on read.
 */
export interface Session {
  token: string;
  expiresAt: string;
}

const KEY = 'aicoach.session';
export const LOGOUT_EVENT = 'aicoach:logout';

export function readSession(now = Date.now()): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (typeof s.token !== 'string' || typeof s.expiresAt !== 'string') return null;
    if (Date.parse(s.expiresAt) <= now) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { token: s.token, expiresAt: s.expiresAt };
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the session simply won't survive a reload.
  }
}
