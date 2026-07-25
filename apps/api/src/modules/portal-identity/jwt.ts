import { randomBytes, createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { OrgRole } from './types.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env['PORTAL_JWT_SECRET'] ?? 'atlas-portal-dev-secret-change-in-prod'
);

/** Deliberately a single, longer-lived session token — no refresh-token flow
 * (unlike admin-identity's access/refresh pair) since the org self-service
 * surface doesn't need that complexity for v1. */
export const SESSION_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface PortalSessionPayload {
  sub: string;
  organizationId: string;
  role: OrgRole;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

export async function signPortalSessionToken(claims: {
  sub: string;
  organizationId: string;
  role: OrgRole;
  name: string;
  email: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    organizationId: claims.organizationId,
    role: claims.role,
    name: claims.name,
    email: claims.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TOKEN_TTL_SECONDS)
    .sign(JWT_SECRET);
}

export async function verifyPortalSessionToken(
  token: string
): Promise<PortalSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || typeof payload['organizationId'] !== 'string') return null;
    return payload as unknown as PortalSessionPayload;
  } catch {
    return null;
  }
}

// ─── Invite tokens (opaque, never stored in plaintext) ─────────────────────

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
