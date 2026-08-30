import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { secretRotationScheduler } from '../../../modules/security/secret-rotation.js';
import { securityStore } from '../../../modules/security/security-store.js';

export function registerSecretRotationRoutes(router: Router): void {
  /**
   * ATLAS 46.26 — final hardening, Part 1: previously had no tenant check
   * at all — with `secretId` omitted, any authenticated caller (of any
   * tenant) got the rotation history (secret name, tenantId, rotatedAt) of
   * every tenant's secrets. Fixed to always scope to the caller's own
   * session org; a `secretId` filter is additionally verified to belong to
   * that org before its history is returned, matching every other `:id`
   * ownership check in this module.
   */
  // GET /api/v1/security/secrets/rotation/history
  router.get(
    '/api/v1/security/secrets/rotation/history',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireOrgId(ctx);
      const secretId = ctx.query.get('secretId') ?? undefined;
      if (secretId) {
        const secret = securityStore.getSecretById(secretId);
        if (!secret || secret.tenantId !== tenantId) {
          return apiError(res, 'Secret not found', 404);
        }
      }
      const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);
      // Fetch unfiltered-by-tenant first (Number.MAX_SAFE_INTEGER, not the
      // scheduler's own small default) so filtering to this tenant below
      // never truncates real history behind other tenants' more-recent
      // entries in the shared, newest-first list.
      const history = secretRotationScheduler
        .getHistory(secretId, Number.MAX_SAFE_INTEGER)
        .filter((r) => r.tenantId === tenantId)
        .slice(0, limit);
      json(res, { history, total: history.length });
    }
  );

  /**
   * ATLAS 46.26 — final hardening, Part 1: evaluateAll() is a genuinely
   * platform-wide operation by design — it mirrors the scheduler's own
   * internal 60s tick, rotating every tenant's due secrets in one pass, so
   * per-tenant scoping isn't meaningful here (there is no single tenant to
   * scope it to). Previously reachable by "any authenticated tenant
   * session" with no permission check at all — any signed-in user could
   * force fleet-wide rotation on demand (nuisance/availability risk, no
   * plaintext exposure). Fixed by requiring the new admin-only
   * `security.manage` permission, the same requirePermission mechanism
   * every other admin-gated surface in this codebase already uses.
   */
  // POST /api/v1/security/secrets/rotation/evaluate — runs the scheduler's due-check now.
  router.post(
    '/api/v1/security/secrets/rotation/evaluate',
    requirePermission('security.manage')(async (_ctx: RouteContext, res: ServerResponse) => {
      const rotated = await secretRotationScheduler.evaluateAll();
      json(res, { rotated, total: rotated.length });
    })
  );

  /**
   * POST /api/v1/security/secrets/:id/rotate-now — force-rotates one secret
   * regardless of due date. ATLAS 46.26: previously had no tenant check at
   * all — same class of bug as secrets.ts's rotate/decrypt/delete routes,
   * fixed the same way (session-derived org, ownership verified before
   * the scheduler ever touches the secret).
   */
  router.post(
    '/api/v1/security/secrets/:id/rotate-now',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireOrgId(ctx);
      const existing = securityStore.getSecretById(ctx.params['id']);
      if (!existing || existing.tenantId !== tenantId) {
        return apiError(res, 'Secret not found', 404);
      }
      const result = await secretRotationScheduler.rotateNow(ctx.params['id']);
      if (!result) return apiError(res, 'Secret not found', 404);
      json(res, result);
    }
  );
}
