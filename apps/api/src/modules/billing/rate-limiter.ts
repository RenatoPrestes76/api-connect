import { PLANS } from '@seltriva/billing';
import type { PlanSlug } from '@seltriva/billing';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter, per tenant, keyed by planSlug.
 * Enterprise (rateLimit=0) is never limited — treated as custom/unlimited.
 */
class RateLimiter {
  private windows: Map<string, Window> = new Map();

  /**
   * Returns true if the request is allowed, false if rate-limited.
   * Also increments the counter for this window.
   */
  check(tenantId: string, planSlug: PlanSlug): boolean {
    const plan = PLANS.find((p) => p.slug === planSlug);
    const limit = plan?.rateLimit ?? 100;

    // Enterprise (limit=0) means custom/negotiated — always allow
    if (limit === 0) return true;

    const key = tenantId;
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || now > existing.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }

    if (existing.count >= limit) return false;

    existing.count += 1;
    return true;
  }

  /** Returns remaining requests for this window (for headers). */
  remaining(tenantId: string, planSlug: PlanSlug): number {
    const plan = PLANS.find((p) => p.slug === planSlug);
    const limit = plan?.rateLimit ?? 100;
    if (limit === 0) return 9999;

    const w = this.windows.get(tenantId);
    if (!w || Date.now() > w.resetAt) return limit;
    return Math.max(0, limit - w.count);
  }

  /** Reset a tenant's window (used in tests). */
  reset(tenantId: string): void {
    this.windows.delete(tenantId);
  }
}

export const rateLimiter = new RateLimiter();
