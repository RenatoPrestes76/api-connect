import { verify } from 'node:crypto';

/**
 * Verifies that `signatureBase64` is a valid signature of `payload` produced
 * by the private key matching `publicKeyPem`. The Runtime signs every
 * authenticated request (heartbeat, etc.) client-side with the private key
 * it generated at install time; only the public key half is ever
 * transmitted (at registration).
 *
 * Requires an Ed25519 key pair (`crypto.generateKeyPairSync('ed25519')`) —
 * passing `null` as the algorithm to Node's sign/verify only works for keys
 * with a built-in hash (Ed25519/Ed448); RSA/EC keys would need an explicit
 * digest algorithm instead.
 */
export function verifyRequestSignature(
  payload: string,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    return verify(null, Buffer.from(payload), publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}

/** Canonical string a Runtime must sign for a given heartbeat payload — stable key order. */
export function canonicalHeartbeatPayload(input: {
  runtimeId: string;
  version: string;
  memory: number;
  cpu: number;
  status?: string;
  timestamp: string;
}): string {
  return JSON.stringify({
    runtimeId: input.runtimeId,
    version: input.version,
    memory: input.memory,
    cpu: input.cpu,
    status: input.status ?? null,
    timestamp: input.timestamp,
  });
}

/**
 * Canonical string a Runtime must sign to prove its identity when exchanging
 * for a JWT session (POST /runtime/auth/token) — a lighter-weight proof than
 * heartbeat's, since it commits to nothing but who's asking and when.
 */
export function canonicalAuthTokenPayload(input: { runtimeId: string; timestamp: string }): string {
  return JSON.stringify({ runtimeId: input.runtimeId, timestamp: input.timestamp });
}
