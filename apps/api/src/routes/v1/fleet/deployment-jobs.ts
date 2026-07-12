import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { fleetOpsStore } from '../../../modules/fleet-ops/fleet-ops-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { DeploymentMode, DeploymentStrategy } from '../../../modules/fleet-ops/types.js';

const VALID_STRATEGIES: DeploymentStrategy[] = ['ROLLING', 'BLUE_GREEN', 'CANARY'];

export function registerDeploymentJobRoutes(router: { get: Function; post: Function }): void {
  // GET /admin/fleet/deployments — DeploymentJob list (approval/scheduling wrapper around
  // /admin/control-plane/deployments, which stays the low-level version-rollout record).
  router.get(
    '/admin/fleet/deployments',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const mode = ctx.query.get('mode') ?? undefined;
      const jobs = fleetOpsStore.listDeploymentJobs({ organizationId, status, mode });
      json(res, { jobs, total: jobs.length });
    })
  );

  router.get(
    '/admin/fleet/deployments/:id',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const job = fleetOpsStore.getDeploymentJob(ctx.params?.id as string);
      if (!job) return apiError(res, 'Deployment job not found', 404, 'JOB_NOT_FOUND');
      json(res, job);
    })
  );

  router.get(
    '/admin/fleet/deployments/:id/tasks',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const tasks = fleetOpsStore.getDeploymentTasks(ctx.params?.id as string);
      json(res, { tasks, total: tasks.length });
    })
  );

  router.post(
    '/admin/fleet/deployments',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | {
            organizationId?: string;
            environmentId?: string;
            pluginId?: string;
            pluginVersionId?: string;
            mode?: DeploymentMode;
            strategy?: DeploymentStrategy;
            autoRollback?: boolean;
            scheduledAt?: string;
          }
        | undefined;
      if (
        !body?.organizationId ||
        !body?.environmentId ||
        !body?.pluginId ||
        !body?.pluginVersionId ||
        !body?.mode
      ) {
        return apiError(
          res,
          'organizationId, environmentId, pluginId, pluginVersionId and mode are required',
          400,
          'MISSING_FIELDS'
        );
      }
      if (body.mode === 'SCHEDULED' && !body.scheduledAt) {
        return apiError(
          res,
          'scheduledAt is required for scheduled deployments',
          400,
          'MISSING_SCHEDULED_AT'
        );
      }
      if (body.strategy && !VALID_STRATEGIES.includes(body.strategy)) {
        return apiError(
          res,
          'strategy must be one of: ROLLING, BLUE_GREEN, CANARY',
          400,
          'INVALID_STRATEGY'
        );
      }
      const job = fleetOpsStore.createDeploymentJob({
        organizationId: body.organizationId,
        environmentId: body.environmentId,
        pluginId: body.pluginId,
        pluginVersionId: body.pluginVersionId,
        mode: body.mode,
        strategy: body.strategy,
        autoRollback: body.autoRollback,
        scheduledAt: body.scheduledAt,
        requestedBy: ctx.adminUserId,
      });
      adminIdentityStore.recordAudit({
        action: 'CREATE_DEPLOYMENT_JOB',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: job.id,
        metadata: { mode: job.mode },
      });
      json(res, job, 201);
    })
  );

  router.post(
    '/admin/fleet/deployments/:id/approve',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = fleetOpsStore.approveDeploymentJob(id, ctx.adminUserId);
      if (result === 'NOT_FOUND')
        return apiError(res, 'Deployment job not found', 404, 'JOB_NOT_FOUND');
      if (result === 'NOT_APPROVABLE')
        return apiError(res, 'Job is not pending approval', 400, 'NOT_APPROVABLE');
      adminIdentityStore.recordAudit({
        action: 'APPROVE_DEPLOYMENT_JOB',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, result);
    })
  );

  router.post(
    '/admin/fleet/deployments/:id/reject',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = fleetOpsStore.rejectDeploymentJob(id);
      if (result === 'NOT_FOUND')
        return apiError(res, 'Deployment job not found', 404, 'JOB_NOT_FOUND');
      if (result === 'NOT_REJECTABLE')
        return apiError(res, 'Job cannot be rejected in its current state', 400, 'NOT_REJECTABLE');
      adminIdentityStore.recordAudit({
        action: 'REJECT_DEPLOYMENT_JOB',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, result);
    })
  );

  router.post(
    '/admin/fleet/deployments/:id/rollback',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = fleetOpsStore.rollbackDeploymentJob(id);
      if (result === 'NOT_FOUND')
        return apiError(res, 'Deployment job not found', 404, 'JOB_NOT_FOUND');
      if (result === 'NOT_ROLLBACKABLE') {
        return apiError(res, 'Only successful jobs can be rolled back', 400, 'NOT_ROLLBACKABLE');
      }
      adminIdentityStore.recordAudit({
        action: 'ROLLBACK_DEPLOYMENT_JOB',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, result);
    })
  );

  // Chaos-testing hook (Sprint 47 / ATLAS FORTRESS): forces the job's next execution to fail at a
  // named step, exercising the automatic-rollback path for real. Only affects jobs not yet executed
  // (PENDING_APPROVAL / SCHEDULED) — call this, then approve the job or let its schedule tick.
  router.post(
    '/admin/fleet/deployments/:id/inject-failure',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const body = ctx.body as { atStep?: string } | undefined;
      if (!body?.atStep) return apiError(res, '"atStep" is required', 400, 'MISSING_FIELDS');

      const job = fleetOpsStore.getDeploymentJob(id);
      if (!job) return apiError(res, 'Deployment job not found', 404, 'JOB_NOT_FOUND');
      if (job.status !== 'PENDING_APPROVAL' && job.status !== 'SCHEDULED') {
        return apiError(
          res,
          'Failure can only be injected before the job executes',
          400,
          'ALREADY_EXECUTED'
        );
      }

      fleetOpsStore.injectDeploymentFailure(id, body.atStep);
      adminIdentityStore.recordAudit({
        action: 'INJECT_DEPLOYMENT_FAILURE',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
        metadata: { atStep: body.atStep },
      });
      json(res, { jobId: id, atStep: body.atStep });
    })
  );
}
