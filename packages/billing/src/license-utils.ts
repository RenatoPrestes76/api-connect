import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { PlanSlug } from './types.js';

const HMAC_SECRET = 'atlas-license-signing-key-v1';

/**
 * Generates a deterministic-looking license key.
 * Format: ATLAS-{PLAN}-{A}-{B}-{C}-{D}  (each segment 4 hex chars)
 */
export function generateLicenseKey(tenantId: string, planSlug: PlanSlug): string {
  const entropy = `${tenantId}:${planSlug}:${Date.now()}`;
  const hash = createHash('sha256').update(entropy).digest('hex');
  const seg = (start: number) => hash.slice(start, start + 4).toUpperCase();
  const prefix = planSlug.slice(0, 4).toUpperCase();
  return `ATLAS-${prefix}-${seg(0)}-${seg(4)}-${seg(8)}-${seg(12)}`;
}

/**
 * Computes an HMAC-SHA256 signature binding a key to a tenant and plan.
 */
export function generateSignature(key: string, tenantId: string, planSlug: PlanSlug): string {
  return createHmac('sha256', HMAC_SECRET).update(`${key}:${tenantId}:${planSlug}`).digest('hex');
}

/**
 * Constant-time signature validation to prevent timing attacks.
 */
export function validateSignature(
  key: string,
  tenantId: string,
  planSlug: PlanSlug,
  signature: string
): boolean {
  try {
    const expected = Buffer.from(generateSignature(key, tenantId, planSlug), 'hex');
    const provided = Buffer.from(signature, 'hex');
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

/**
 * Validates the format of a license key without checking the signature.
 */
export function isValidKeyFormat(key: string): boolean {
  return /^ATLAS-[A-Z]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(key);
}

/**
 * Returns a short fingerprint of a license key for display purposes.
 */
export function keyFingerprint(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 12).toUpperCase();
}
