import { randomBytes, createHash } from 'node:crypto';

/** Public, non-secret identifier — safe to log/display. */
export function generatePublicId(): string {
  return `atl_pub_${randomBytes(6).toString('hex')}`;
}

/** High-entropy secret shown to the caller exactly once. */
export function generateApiKeySecret(): string {
  return `atl_sk_${randomBytes(24).toString('hex')}`;
}

export function hashApiKeySecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
