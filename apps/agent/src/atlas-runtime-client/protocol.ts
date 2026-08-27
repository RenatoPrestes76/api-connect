/**
 * Client-side mirror of apps/api's
 * `modules/runtime-registration/signature.ts` canonical payload builders.
 * Re-implemented here (not imported — apps/agent and apps/api are sibling
 * apps, not layered as library/consumer) with the exact same field order,
 * since the server recomputes and byte-compares this same JSON string
 * before verifying the signature. Any drift here is a real protocol bug,
 * not a style choice — see the E2E test
 * (apps/api/src/__tests__/runtime-registration/real-client-enrollment-e2e.test.ts)
 * for the proof this stays in sync with the server.
 */
import { sign } from 'node:crypto';

export interface CanonicalHeartbeatInput {
  runtimeId: string;
  version: string;
  memory: number;
  cpu: number;
  status?: string;
  timestamp: string;
}

export function canonicalHeartbeatPayload(input: CanonicalHeartbeatInput): string {
  return JSON.stringify({
    runtimeId: input.runtimeId,
    version: input.version,
    memory: input.memory,
    cpu: input.cpu,
    status: input.status ?? null,
    timestamp: input.timestamp,
  });
}

export interface CanonicalAuthTokenInput {
  runtimeId: string;
  timestamp: string;
}

export function canonicalAuthTokenPayload(input: CanonicalAuthTokenInput): string {
  return JSON.stringify({ runtimeId: input.runtimeId, timestamp: input.timestamp });
}

/**
 * Signs `payload` with the Runtime's Ed25519 private key. `crypto.sign`
 * with a `null` algorithm is Ed25519/Ed448-specific — the key type itself
 * determines the hash, unlike RSA/EC which need an explicit digest name.
 */
export function signPayload(privateKeyPem: string, payload: string): string {
  return sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
}
