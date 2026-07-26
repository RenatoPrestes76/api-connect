import { randomUUID, createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const CERT_SECRET = new TextEncoder().encode(
  process.env['RUNTIME_CERT_SECRET'] ?? 'atlas-runtime-cert-dev-secret-change-in-prod'
);

export const CERTIFICATE_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year, matches AgentAccessToken's TTL convention

export interface IssuedCertificate {
  certificate: string;
  certificateId: string;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * Issues a signed certificate binding a runtimeId to the public key it
 * registered with. The certificate itself is a stateless, verifiable JWT;
 * revocation is still possible because the caller persists `certificateId`
 * (the JWT's `jti`) and checks it against a revocation flag on every use —
 * the same revocable-stateless-token pattern as AgentAccessToken.
 */
export async function issueCertificate(
  runtimeId: string,
  publicKey: string
): Promise<IssuedCertificate> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CERTIFICATE_TTL_SECONDS * 1000);
  const certificateId = randomUUID();
  const publicKeyFingerprint = createHash('sha256').update(publicKey).digest('hex');

  const certificate = await new SignJWT({ publicKeyFingerprint })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(runtimeId)
    .setJti(certificateId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(CERT_SECRET);

  return { certificate, certificateId, issuedAt: now, expiresAt };
}

export interface VerifiedCertificate {
  runtimeId: string;
  certificateId: string;
}

/** Verifies signature + expiry only — callers must separately check the stored revocation flag. */
export async function verifyCertificate(token: string): Promise<VerifiedCertificate | null> {
  try {
    const { payload } = await jwtVerify(token, CERT_SECRET);
    if (!payload.sub || typeof payload.jti !== 'string') return null;
    return { runtimeId: payload.sub, certificateId: payload.jti };
  } catch {
    return null;
  }
}
