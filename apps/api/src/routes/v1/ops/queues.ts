import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { titanStore } from '../../../modules/titan/titan-store.js';
import type { JobPriority } from '../../../modules/titan/titan-store.js';

/**
 * ATLAS 46.26 — Part H audit decision: this module is deliberately
 * admin-global, NOT tenant-scoped, and this file is left that way on
 * purpose (unlike portal/connectors.ts, portal/dashboard.ts,
 * portal/support.ts, and every security/* file, which had the SAME
 * `requireTenantId` pattern but were genuine BOLA holes and were fixed).
 * The distinguishing facts:
 *
 *   - `ops/queues.ts` is the ONLY file in `ops/*` (health, dashboard,
 *     feature-flags, slo, dr, circuit-breakers) that references a tenant
 *     concept at all — its six siblings have no tenant/permission check
 *     whatsoever and are already, uniformly, "any authenticated staff
 *     session sees the whole platform's operational state".
 *   - `titanStore`'s data (job queue, DLQ, SLOs, DR status, circuit
 *     breakers) is platform/SRE operational telemetry, not tenant-owned
 *     business data (contrast with billing invoices or security secrets).
 *   - `GET /queues` already returns every tenant's jobs unfiltered by
 *     design — an ops dashboard showing only one tenant's slice of the
 *     platform queue would defeat its purpose. Restricting `enqueue`'s
 *     `tenantId` (attribution only, for a staff member manually
 *     queuing/replaying a job "on behalf of" a specific tenant) or
 *     `dlq/retry` (operating on a job any staff viewer can already see
 *     via the same unfiltered list) would be asymmetric with that
 *     already-global read surface, not a real hardening.
 *
 * Not fixed: making `ops/*` require admin-identity's `requirePermission`
 * instead of the generic Supabase authMiddleware would be a real, useful
 * hardening step, but it's a decision spanning all seven files uniformly,
 * not a targeted vulnerability fix — out of this sprint's "no
 * architectural rewrite" boundary. Flagged as a residual risk in the
 * final report, not silently left unmentioned.
 *
 * Final hardening, Part 6 — re-confirmed via real auth-chain tests
 * (__tests__/ops/ops-routes.test.ts's "Ops — auth boundary" block):
 * portal users and Runtimes are structurally excluded (different JWT
 * signing secrets — PORTAL_JWT_SECRET / RUNTIME_JWT_SECRET can never
 * verify against this middleware's SUPABASE_JWT_SECRET), and anonymous
 * callers are rejected. NOT reclassified as "ACCEPTED ARCHITECTURAL
 * DESIGN" outright: whether every non-staff identity is excluded depends
 * on who is provisioned in the external Supabase Auth tenant this generic
 * middleware verifies against — outside this codebase's visibility and
 * outside this sprint's "no ops architecture change" boundary. Reported
 * as DEFERRED/EXTERNAL, not silently marked complete.
 */

interface EnqueueBody {
  type?: string;
  tenantId?: string;
  priority?: JobPriority;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  idempotencyKey?: string;
}

interface DlqRetryBody {
  jobId?: string;
}

export function registerQueuesRoutes(router: Router): void {
  // GET /api/v1/ops/queues — queue summary + job list
  router.get('/api/v1/ops/queues', async (ctx: RouteContext, res: ServerResponse) => {
    const priority = ctx.query.get('priority') as JobPriority | null;
    const jobs = titanStore.listJobs(priority ?? undefined);
    const dlq = titanStore.listDlq();
    const stats = titanStore.getQueueStats();
    json(res, { stats, jobs, dlq });
  });

  // POST /api/v1/ops/queues/enqueue — enqueue a new job
  router.post('/api/v1/ops/queues/enqueue', async (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as EnqueueBody | undefined;
    const type = body?.type;
    const tenantId = requireTenantId(ctx, body?.tenantId);

    if (!type) return apiError(res, '"type" is required', 400, 'MISSING_TYPE');

    const result = titanStore.enqueue({
      type,
      priority: body?.priority ?? 'normal',
      payload: body?.payload ?? {},
      tenantId,
      maxAttempts: body?.maxAttempts ?? 3,
      idempotencyKey: body?.idempotencyKey,
    });

    if (!result) {
      return apiError(res, 'Duplicate idempotency key', 409, 'DUPLICATE_JOB');
    }
    json(res, { job: result }, 201);
  });

  // POST /api/v1/ops/queues/dlq/retry — retry a dead job
  router.post('/api/v1/ops/queues/dlq/retry', async (ctx: RouteContext, res: ServerResponse) => {
    const jobId = (ctx.body as DlqRetryBody | undefined)?.jobId;
    if (!jobId) return apiError(res, '"jobId" is required', 400, 'MISSING_JOB_ID');
    const job = titanStore.retryDlq(jobId);
    if (!job) return apiError(res, 'Job not found in DLQ', 404, 'JOB_NOT_FOUND');
    json(res, { job });
  });
}
