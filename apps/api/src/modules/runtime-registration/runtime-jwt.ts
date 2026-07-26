import { randomBytes, createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env['RUNTIME_JWT_SECRET'] ?? 'atlas-runtime-dev-secret-change-in-prod'
);

export const RUNTIME_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const RUNTIME_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — Runtimes are long-lived installs, not interactive users

export interface RuntimeAccessTokenPayload {
  sub: string; // runtimeId
  organizationId: string;
  iat: number;
  exp: number;
}

export async function signRuntimeAccessToken(claims: {
  runtimeId: string;
  organizationId: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ organizationId: claims.organizationId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.runtimeId)
    .setIssuedAt(now)
    .setExpirationTime(now + RUNTIME_ACCESS_TOKEN_TTL_SECONDS)
    .sign(JWT_SECRET);
}

export async function verifyRuntimeAccessToken(
  token: string
): Promise<RuntimeAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || typeof payload['organizationId'] !== 'string') return null;
    return payload as unknown as RuntimeAccessTokenPayload;
  } catch {
    return null;
  }
}

/** Opaque, cryptographically random refresh token — never stored in plaintext. */
export function generateRuntimeRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export function hashRuntimeRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
