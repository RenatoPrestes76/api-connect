const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptWindow {
  failures: number;
  windowStartedAt: number;
}

/**
 * In-memory login-attempt tracker: blocks a given email+IP pair after
 * MAX_ATTEMPTS failures within LOCKOUT_WINDOW_MS. A successful login clears
 * the counter for that key.
 */
class LoginRateLimiter {
  private windows = new Map<string, AttemptWindow>();

  private key(email: string, ip: string): string {
    return `${email.toLowerCase()}|${ip}`;
  }

  isLocked(email: string, ip: string): boolean {
    const w = this.windows.get(this.key(email, ip));
    if (!w) return false;
    if (Date.now() - w.windowStartedAt > LOCKOUT_WINDOW_MS) return false;
    return w.failures >= MAX_ATTEMPTS;
  }

  recordFailure(email: string, ip: string): void {
    const key = this.key(email, ip);
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || now - existing.windowStartedAt > LOCKOUT_WINDOW_MS) {
      this.windows.set(key, { failures: 1, windowStartedAt: now });
      return;
    }
    existing.failures += 1;
  }

  recordSuccess(email: string, ip: string): void {
    this.windows.delete(this.key(email, ip));
  }

  remainingLockoutMs(email: string, ip: string): number {
    const w = this.windows.get(this.key(email, ip));
    if (!w) return 0;
    const elapsed = Date.now() - w.windowStartedAt;
    return Math.max(0, LOCKOUT_WINDOW_MS - elapsed);
  }
}

export const loginRateLimiter = new LoginRateLimiter();
export { MAX_ATTEMPTS, LOCKOUT_WINDOW_MS };
