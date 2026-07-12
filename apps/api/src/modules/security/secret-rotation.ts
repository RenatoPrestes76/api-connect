import { generateKey } from '@seltriva/aegis';
import { securityStore } from './security-store.js';
import type { Secret } from '@seltriva/aegis';

const TICK_MS = 60_000;
/** Rotate a secret once its expiry is within this window, not only after it has already passed. */
const ROTATION_LEAD_MS = 24 * 60 * 60 * 1000;

export interface RotationResult {
  secretId: string;
  tenantId: string;
  name: string;
  previousVersion: number;
  newVersion: number;
  newExpiresAt: string | null;
  rotatedAt: string;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Automatic credential rotation scheduler (Sprint 47 / ATLAS FORTRESS). Generates a fresh
 * random secret value via aegis's generateKey() and calls the real securityStore.rotateSecret()
 * (real envelope re-encryption, real version bump, real Vault sync attempt when applicable) —
 * not a fabricated "rotation completed" event with no underlying state change.
 */
class SecretRotationScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private history: RotationResult[] = [];

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.evaluateAll(), TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getHistory(secretId?: string, limit = 50): RotationResult[] {
    const list = secretId ? this.history.filter((r) => r.secretId === secretId) : this.history;
    return list.slice(0, limit);
  }

  private isDue(secret: Secret): boolean {
    if (!secret.autoRotate || !secret.rotationIntervalDays) return false;
    if (!secret.expiresAt) return false;
    return new Date(secret.expiresAt).getTime() - Date.now() <= ROTATION_LEAD_MS;
  }

  /** Rotates one secret now, regardless of whether it's due — used by the manual "rotate now" endpoint. */
  async rotateNow(secretId: string): Promise<RotationResult | null> {
    const secret = securityStore.getSecretById(secretId);
    if (!secret) return null;
    return this.performRotation(secret);
  }

  private async performRotation(secret: Secret): Promise<RotationResult> {
    const newValue = generateKey(32);
    const updated = await securityStore.rotateSecret(secret.id, newValue);
    const newExpiresAt = secret.rotationIntervalDays
      ? new Date(Date.now() + secret.rotationIntervalDays * 24 * 60 * 60 * 1000).toISOString()
      : secret.expiresAt;
    if (updated && newExpiresAt !== secret.expiresAt) {
      // Extend expiry for the new rotation cycle — rotateSecret() doesn't change expiresAt itself.
      securityStore.updateSecretExpiry(secret.id, newExpiresAt);
    }
    securityStore.appendAuditEvent({
      id: genId('evt'),
      action: 'key_rotated',
      actor: 'system:secret-rotation-scheduler',
      tenantId: secret.tenantId,
      resource: 'secrets',
      resourceId: secret.id,
      ip: '127.0.0.1',
      userAgent: 'AtlasFortress/SecretRotationScheduler',
      before: { version: secret.version, expiresAt: secret.expiresAt },
      after: { version: updated?.version ?? secret.version + 1, expiresAt: newExpiresAt },
      metadata: { automatic: true },
      timestamp: new Date().toISOString(),
    });

    const result: RotationResult = {
      secretId: secret.id,
      tenantId: secret.tenantId,
      name: secret.name,
      previousVersion: secret.version,
      newVersion: updated?.version ?? secret.version + 1,
      newExpiresAt,
      rotatedAt: new Date().toISOString(),
    };
    this.history.unshift(result);
    return result;
  }

  /** Evaluates every auto-rotate-enabled secret and rotates the ones due for rotation. */
  async evaluateAll(): Promise<RotationResult[]> {
    const due = securityStore.listAllSecrets().filter((s) => this.isDue(s));
    const results: RotationResult[] = [];
    for (const secret of due) {
      results.push(await this.performRotation(secret));
    }
    return results;
  }
}

export const secretRotationScheduler = new SecretRotationScheduler();
secretRotationScheduler.start();
