import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
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
 *     concept at all — its six siblings have no tenant concept
 *     whatsoever and are already, uniformly, "any staff session sees the
 *     whole platform's operational state".
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
 * ATLAS 46.27 — closes the residual flagged at the end of 46.26:
 * `requireTenantId` here was NEVER the authorization boundary (it never
 * gated who could call this route — only whether an attribution label
 * was present) and stays exactly that: an attribution field on the
 * enqueued job, still validated as present, still never trusted for
 * access control. The actual authorization boundary is now the
 * `requirePermission('ops.manage')` gate below, same mechanism as every
 * other admin-gated surface in this codebase.
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
  router.get(
    '/api/v1/ops/queues',
    requirePermission('ops.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const priority = ctx.query.get('priority') as JobPriority | null;
      const jobs = titanStore.listJobs(priority ?? undefined);
      const dlq = titanStore.listDlq();
      const stats = titanStore.getQueueStats();
      json(res, { stats, jobs, dlq });
    })
  );

  // POST /api/v1/ops/queues/enqueue — enqueue a new job
  router.post(
    '/api/v1/ops/queues/enqueue',
    requirePermission('ops.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as EnqueueBody | undefined;
      const type = body?.type;
      // Attribution label only — never an authorization boundary. See the
      // module doc comment above.
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
    })
  );

  // POST /api/v1/ops/queues/dlq/retry — retry a dead job
  router.post(
    '/api/v1/ops/queues/dlq/retry',
    requirePermission('ops.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const jobId = (ctx.body as DlqRetryBody | undefined)?.jobId;
      if (!jobId) return apiError(res, '"jobId" is required', 400, 'MISSING_JOB_ID');
      const job = titanStore.retryDlq(jobId);
      if (!job) return apiError(res, 'Job not found in DLQ', 404, 'JOB_NOT_FOUND');
      json(res, { job });
    })
  );
}
