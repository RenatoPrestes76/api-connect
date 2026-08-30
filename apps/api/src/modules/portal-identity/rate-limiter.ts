const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptWindow {
  failures: number;
  windowStartedAt: number;
}

/**
 * ATLAS 46.26 — Part N: the portal login endpoint (customer self-service,
 * publicly reachable, protecting real tenant data) had no brute-force
 * protection at all, unlike admin-identity's /admin/auth/login, which
 * already had this exact mechanism. Same shape as
 * modules/admin-identity/rate-limiter.ts (this module keeps its own copy
 * rather than sharing one across modules, matching the existing repo
 * convention — admin-identity, runtime-registration, and billing each
 * already have their own independent rate-limiter).
 *
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
}

export const loginRateLimiter = new LoginRateLimiter();
export { MAX_ATTEMPTS, LOCKOUT_WINDOW_MS };
