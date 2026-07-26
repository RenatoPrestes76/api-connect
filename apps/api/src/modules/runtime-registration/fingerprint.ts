import { createHash } from 'node:crypto';

/**
 * The Runtime installer computes its own fingerprint client-side (CPU,
 * motherboard, disk, MAC address, hostname) and sends it as an opaque
 * string. The server never sees or stores hardware identifiers in clear
 * text — only this hash, so registration can still detect a duplicate
 * install without being able to reverse-engineer the source machine.
 */
export function hashFingerprint(rawFingerprint: string): string {
  return createHash('sha256').update(rawFingerprint).digest('hex');
}
