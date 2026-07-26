import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { jobOrchestrationStore } from '../../../modules/job-orchestration/job-orchestration-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type {
  JobCommand,
  JobPriority,
  JobStatus,
  JobOrigin,
  CreateJobError,
} from '../../../modules/job-orchestration/types.js';

interface CreateJobBody {
  organizationId?: string;
  runtimeId?: string;
  connectorId?: string;
  command?: JobCommand;
  payload?: Record<string, unknown>;
  priority?: JobPriority;
  origin?: JobOrigin;
  idempotencyKey?: string;
  maxAttempts?: number;
  timeoutMs?: number;
}

const CREATE_ERROR_STATUS: Record<CreateJobError, { status: number; message: string }> = {
  RUNTIME_NOT_FOUND: { status: 404, message: 'Runtime not found' },
  RUNTIME_ORGANIZATION_MISMATCH: {
    status: 403,
    message: 'This Runtime does not belong to the given organizationId',
  },
};

export function registerJobRoutes(router: Router): void {
  // ─── POST /jobs ──────────────────────────────────────────────────────────
  router.post(
    '/jobs',
    requirePermission('job-orchestration.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as CreateJobBody | undefined) ?? {};
      const {
        organizationId,
        runtimeId,
        connectorId,
        command,
        payload,
        priority,
        idempotencyKey,
        maxAttempts,
        timeoutMs,
      } = body;
      if (!organizationId || !runtimeId || !command) {
        return apiError(
          res,
          'organizationId, runtimeId, and command are required',
          422,
          'VALIDATION_ERROR'
        );
      }

      const result = jobOrchestrationStore.createJob({
        organizationId,
        runtimeId,
        connectorId,
        command,
        payload,
        priority,
        createdBy: ctx.adminEmail ?? 'unknown',
        origin: body.origin ?? 'ADMIN',
        idempotencyKey,
        maxAttempts,
        timeoutMs,
      });
      if (!result.ok) {
        const mapped = CREATE_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'JOB_CREATED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.job.id,
        metadata: { runtimeId, command, organizationId },
      });
      json(res, { job: jobOrchestrationStore.toDTO(result.job) }, 201);
    })
  );

  // ─── GET /jobs ───────────────────────────────────────────────────────────
  router.get(
    '/jobs',
    requirePermission('job-orchestration.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const runtimeId = ctx.query.get('runtimeId') ?? undefined;
      const status = (ctx.query.get('status') as JobStatus | null) ?? undefined;
      const jobs = jobOrchestrationStore.listJobs({ organizationId, runtimeId, status });
      json(res, { total: jobs.length, jobs: jobs.map((j) => jobOrchestrationStore.toDTO(j)) });
    })
  );

  // ─── GET /jobs/:id ───────────────────────────────────────────────────────
  router.get(
    '/jobs/:id',
    requirePermission('job-orchestration.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const job = jobOrchestrationStore.getJob(ctx.params['id'] as string);
      if (!job) return apiError(res, 'Job not found', 404, 'NOT_FOUND');
      json(res, { job: jobOrchestrationStore.toDTO(job) });
    })
  );

  // ─── POST /jobs/:id/cancel ───────────────────────────────────────────────
  router.post(
    '/jobs/:id/cancel',
    requirePermission('job-orchestration.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const result = jobOrchestrationStore.cancelJob(ctx.params['id'] as string);
      if (!result.ok) {
        const status = result.error === 'JOB_NOT_FOUND' ? 404 : 409;
        const message =
          result.error === 'JOB_NOT_FOUND'
            ? 'Job not found'
            : 'Job is already in a terminal state and cannot be cancelled';
        return apiError(res, message, status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'JOB_CANCELLED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.job.id,
      });
      json(res, { job: jobOrchestrationStore.toDTO(result.job) });
    })
  );
}
