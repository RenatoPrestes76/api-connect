import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MESSAGE_SECRET =
  process.env['MESSAGE_DELIVERY_SECRET'] ?? 'atlas-message-delivery-dev-secret-change-in-prod';

/** SHA-256 of the canonical payload — lets the Runtime detect corruption independent of the signature check. */
export function computeMessageChecksum(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Signs an outbound (Atlas -> Runtime) message with HMAC-SHA256 so the
 * Runtime can verify authenticity. Synchronous by design, mirroring
 * connectors/package-integrity.ts's signPackage() — there is no per-Runtime
 * "Atlas key" in this codebase, so a shared server-side secret plays the
 * same role the connector registry's package secret already does.
 */
export function signMessagePayload(messageId: string, checksum: string): string {
  const payload = `${messageId}:${checksum}`;
  const mac = createHmac('sha256', MESSAGE_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${mac}`;
}

/** Verifies an outbound message signature produced by signMessagePayload(). */
export function verifyMessagePayloadSignature(
  messageId: string,
  checksum: string,
  signature: string
): boolean {
  const [encodedPayload, mac] = signature.split('.');
  if (!encodedPayload || !mac) return false;

  const expectedPayload = `${messageId}:${checksum}`;
  const expectedMac = createHmac('sha256', MESSAGE_SECRET).update(expectedPayload).digest('hex');
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expectedMac);
  return macBuf.length === expectedBuf.length && timingSafeEqual(macBuf, expectedBuf);
}

/**
 * Canonical payload builders for the Runtime-signed requests in this module
 * (ACK, pending-poll). Verification itself reuses
 * runtime-registration/signature.ts's verifyRequestSignature (Ed25519) —
 * only the shape of what gets signed is specific to message-delivery.
 */
export function canonicalAckPayload(input: {
  messageId: string;
  runtimeId: string;
  timestamp: string;
}): string {
  return JSON.stringify({
    messageId: input.messageId,
    runtimeId: input.runtimeId,
    timestamp: input.timestamp,
  });
}

export function canonicalPendingPollPayload(input: {
  runtimeId: string;
  timestamp: string;
}): string {
  return JSON.stringify({ runtimeId: input.runtimeId, timestamp: input.timestamp });
}
