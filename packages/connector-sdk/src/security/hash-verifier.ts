import { createHash } from 'node:crypto';

/** Compute the SHA-256 hex digest of a buffer. */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Verify that a buffer's SHA-256 hash matches the expected hex digest.
 * Throws if they do not match.
 */
export function verifyHash(buffer: Buffer, expectedHex: string): void {
  const actual = sha256(buffer);
  if (actual !== expectedHex.toLowerCase()) {
    throw new HashMismatchError(expectedHex, actual);
  }
}

export class HashMismatchError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual:   string,
  ) {
    super(`Hash mismatch: expected ${expected}, got ${actual}`);
    this.name = 'HashMismatchError';
  }
}
