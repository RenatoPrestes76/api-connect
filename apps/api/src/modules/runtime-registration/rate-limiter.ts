const MAX_ATTEMPTS = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptWindow {
  failures: number;
  windowStartedAt: number;
}

/**
 * In-memory registration-attempt tracker, scoped to POST /runtime/register.
 * Blocks a given IP after MAX_ATTEMPTS failures within LOCKOUT_WINDOW_MS —
 * same shape as admin-identity's loginRateLimiter, just a higher threshold
 * since legitimate installers may retry after transient network errors.
 */
class RegistrationRateLimiter {
  private windows = new Map<string, AttemptWindow>();

  isLocked(ip: string): boolean {
    const w = this.windows.get(ip);
    if (!w) return false;
    if (Date.now() - w.windowStartedAt > LOCKOUT_WINDOW_MS) return false;
    return w.failures >= MAX_ATTEMPTS;
  }

  recordFailure(ip: string): void {
    const now = Date.now();
    const existing = this.windows.get(ip);
    if (!existing || now - existing.windowStartedAt > LOCKOUT_WINDOW_MS) {
      this.windows.set(ip, { failures: 1, windowStartedAt: now });
      return;
    }
    existing.failures += 1;
  }

  recordSuccess(ip: string): void {
    this.windows.delete(ip);
  }
}

export const registrationRateLimiter = new RegistrationRateLimiter();
export {
  MAX_ATTEMPTS as REGISTRATION_MAX_ATTEMPTS,
  LOCKOUT_WINDOW_MS as REGISTRATION_LOCKOUT_WINDOW_MS,
};
