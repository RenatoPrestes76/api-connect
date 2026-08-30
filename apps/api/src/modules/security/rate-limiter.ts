const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptWindow {
  failures: number;
  windowStartedAt: number;
}

/**
 * ATLAS 46.26 — final hardening, Part 2: POST /security/mfa/verify had no
 * rate limiting at all — a 6-digit TOTP (1,000,000 combinations) is
 * brute-forceable in a practical timeframe without throttling. Same shape
 * as modules/admin-identity/rate-limiter.ts and
 * modules/portal-identity/rate-limiter.ts (this module keeps its own copy,
 * matching the existing repo convention of one independent rate-limiter
 * per module rather than a shared abstraction).
 *
 * Keyed by (tenantId, userId) — deliberately NOT combined with the
 * caller's IP. tenantId is session-derived (from the authenticated JWT,
 * not client-controllable) and userId identifies the MFA account under
 * attack; an attacker guessing codes for a specific victim hits the same
 * key regardless of what IP or `x-forwarded-for` value they present,
 * closing the "just spoof a header to reset the counter" bypass that an
 * IP-inclusive key would allow. Trade-off, accepted deliberately: this
 * means a malicious actor who knows a victim's tenantId+userId can lock
 * that account's MFA verification by repeatedly failing it — the same
 * category of trade-off every account-lockout mechanism makes, and
 * strictly better here than leaving TOTP unprotected against brute force.
 */
class MfaVerifyRateLimiter {
  private windows = new Map<string, AttemptWindow>();

  private key(tenantId: string, userId: string): string {
    return `${tenantId}|${userId.toLowerCase()}`;
  }

  isLocked(tenantId: string, userId: string): boolean {
    const w = this.windows.get(this.key(tenantId, userId));
    if (!w) return false;
    if (Date.now() - w.windowStartedAt > LOCKOUT_WINDOW_MS) return false;
    return w.failures >= MAX_ATTEMPTS;
  }

  recordFailure(tenantId: string, userId: string): void {
    const key = this.key(tenantId, userId);
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || now - existing.windowStartedAt > LOCKOUT_WINDOW_MS) {
      this.windows.set(key, { failures: 1, windowStartedAt: now });
      return;
    }
    existing.failures += 1;
  }

  recordSuccess(tenantId: string, userId: string): void {
    this.windows.delete(this.key(tenantId, userId));
  }
}

export const mfaVerifyRateLimiter = new MfaVerifyRateLimiter();
export { MAX_ATTEMPTS, LOCKOUT_WINDOW_MS };
