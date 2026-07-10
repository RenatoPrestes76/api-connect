import { createHash } from 'node:crypto';

// ─── Signature Verification ───────────────────────────────────────────────────

export interface VerificationResult {
  valid: boolean;
  checksum: string;
  message: string;
}

export function verifySignature(
  connectorId: string,
  version: string,
  checksum: string,
  signature: string
): VerificationResult {
  // Demo: deterministic checksum derivation
  const expectedChecksum = `cs-${connectorId}-${version}`;
  const expectedSignature = `sig-${expectedChecksum}-atlas`;

  if (checksum !== expectedChecksum) {
    return { valid: false, checksum, message: 'Checksum mismatch — connector may be tampered' };
  }
  if (signature !== expectedSignature) {
    return {
      valid: false,
      checksum,
      message: 'Signature verification failed — invalid atlas signature',
    };
  }

  // Secondary: SHA-256 of the deterministic seed for display
  const hash = createHash('sha256')
    .update(`${connectorId}:${version}:atlas-registry`)
    .digest('hex');
  return { valid: true, checksum: hash.slice(0, 40), message: 'Signature verified' };
}
