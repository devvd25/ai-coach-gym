import { jwtVerify, SignJWT } from 'jose';

export interface TokenService {
  sign(userId: number): Promise<{ token: string; expiresAt: Date }>;
  /** Returns the user id, or null for a missing, expired or tampered token. */
  verify(token: string): Promise<number | null>;
}

export function createTokenService(secret: string, ttlMinutes: number): TokenService {
  const key = new TextEncoder().encode(secret);
  return {
    async sign(userId) {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(userId))
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(key);
      return { token, expiresAt };
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        const id = Number(payload.sub);
        return Number.isInteger(id) && id > 0 ? id : null;
      } catch {
        return null;
      }
    },
  };
}
