import { randomBytes, createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { AdminRoleName } from './types.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env['ADMIN_JWT_SECRET'] ?? 'atlas-admin-dev-secret-change-in-prod'
);

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface AdminAccessTokenPayload {
  sub: string;
  role: AdminRoleName;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

export async function signAdminAccessToken(claims: {
  sub: string;
  role: AdminRoleName;
  name: string;
  email: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: claims.role, name: claims.name, email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(JWT_SECRET);
}

export async function verifyAdminAccessToken(
  token: string
): Promise<AdminAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || typeof payload['role'] !== 'string') return null;
    return payload as unknown as AdminAccessTokenPayload;
  } catch {
    return null;
  }
}

/** Opaque, cryptographically random refresh token — never stored in plaintext. */
export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
