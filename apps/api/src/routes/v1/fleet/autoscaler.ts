import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { autoscaler } from '../../../modules/fleet-ops/autoscaler.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerAutoscalerRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/fleet/autoscaler/policies',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const environmentId = ctx.query.get('environmentId') ?? undefined;
      const policies = autoscaler.listPolicies({ organizationId, environmentId });
      json(res, { policies, total: policies.length });
    })
  );

  router.get(
    '/admin/fleet/autoscaler/policies/:id',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const policy = autoscaler.getPolicy(ctx.params?.id as string);
      if (!policy) return apiError(res, 'Autoscale policy not found', 404, 'POLICY_NOT_FOUND');
      json(res, policy);
    })
  );

  router.post(
    '/admin/fleet/autoscaler/policies',
    requirePermission('runtime.update')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | {
            organizationId?: string;
            environmentId?: string;
            minInstances?: number;
            maxInstances?: number;
            targetCpuPct?: number;
            targetMemPct?: number;
            cooldownMs?: number;
            enabled?: boolean;
          }
        | undefined;

      if (
        !body?.organizationId ||
        !body?.environmentId ||
        body.minInstances === undefined ||
        body.maxInstances === undefined ||
        body.targetCpuPct === undefined ||
        body.targetMemPct === undefined
      ) {
        return apiError(
          res,
          'organizationId, environmentId, minInstances, maxInstances, targetCpuPct and targetMemPct are required',
          400,
          'MISSING_FIELDS'
        );
      }
      if (body.minInstances < 0 || body.maxInstances < body.minInstances) {
        return apiError(res, 'maxInstances must be >= minInstances >= 0', 400, 'INVALID_RANGE');
      }

      const policy = autoscaler.createPolicy({
        organizationId: body.organizationId,
        environmentId: body.environmentId,
        minInstances: body.minInstances,
        maxInstances: body.maxInstances,
        targetCpuPct: body.targetCpuPct,
        targetMemPct: body.targetMemPct,
        cooldownMs: body.cooldownMs,
        enabled: body.enabled,
      });
      adminIdentityStore.recordAudit({
        action: 'CREATE_AUTOSCALE_POLICY',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: policy.id,
      });
      json(res, policy, 201);
    })
  );

  router.patch(
    '/admin/fleet/autoscaler/policies/:id',
    requirePermission('runtime.update')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const body = (ctx.body as any) ?? {};
      const updated = autoscaler.updatePolicy(id, body);
      if (!updated) return apiError(res, 'Autoscale policy not found', 404, 'POLICY_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'UPDATE_AUTOSCALE_POLICY',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, updated);
    })
  );

  router.delete(
    '/admin/fleet/autoscaler/policies/:id',
    requirePermission('runtime.update')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const ok = autoscaler.deletePolicy(id);
      if (!ok) return apiError(res, 'Autoscale policy not found', 404, 'POLICY_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'DELETE_AUTOSCALE_POLICY',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { success: true });
    })
  );

  router.post(
    '/admin/fleet/autoscaler/policies/:id/evaluate',
    requirePermission('runtime.update')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      if (!autoscaler.getPolicy(id))
        return apiError(res, 'Autoscale policy not found', 404, 'POLICY_NOT_FOUND');
      const result = autoscaler.evaluate(id);
      json(res, result);
    })
  );

  router.get(
    '/admin/fleet/autoscaler/events',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const policyId = ctx.query.get('policyId') ?? undefined;
      const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);
      const events = autoscaler.getEvents(policyId, limit);
      json(res, { events, total: events.length });
    })
  );
}
