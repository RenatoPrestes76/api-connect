import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { fleetOpsStore } from '../../../modules/fleet-ops/fleet-ops-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { RuntimeCommandType } from '../../../modules/fleet-ops/types.js';

const REMOTE_ACTIONS: Array<{ path: string; type: RuntimeCommandType }> = [
  { path: 'restart', type: 'RESTART' },
  { path: 'update', type: 'UPDATE' },
  { path: 'reinstall', type: 'REINSTALL' },
  { path: 'sync-now', type: 'SYNC_NOW' },
  { path: 'clear-cache', type: 'CLEAR_CACHE' },
  { path: 'force-heartbeat', type: 'FORCE_HEARTBEAT' },
  { path: 'disable', type: 'DISABLE' },
  { path: 'enable', type: 'ENABLE' },
];

export function registerRuntimeOpsRoutes(router: { get: Function; post: Function }): void {
  // GET /admin/fleet/runtime/status — lightweight status feed for all runtimes
  router.get(
    '/admin/fleet/runtime/status',
    requirePermission('runtime.read')(async (_ctx: RouteContext, res: ServerResponse) => {
      json(res, { runtimes: fleetOpsStore.getRuntimeStatusFeed() });
    })
  );

  // GET /admin/fleet/runtime/:id — full detail (metrics history, health, logs, commands)
  router.get(
    '/admin/fleet/runtime/:id',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const detail = fleetOpsStore.getRuntimeDetail(ctx.params?.id as string);
      if (!detail) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
      json(res, detail);
    })
  );

  // GET /admin/fleet/runtime/:id/logs
  router.get(
    '/admin/fleet/runtime/:id/logs',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const logs = fleetOpsStore.getLogs(ctx.params?.id as string, 100);
      json(res, { logs, total: logs.length });
    })
  );

  // POST /admin/fleet/runtime/heartbeat — ingestion endpoint (real agents would call this)
  router.post(
    '/admin/fleet/runtime/heartbeat',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | {
            runtimeId?: string;
            cpuPct?: number;
            memPct?: number;
            diskPct?: number;
            latencyMs?: number;
          }
        | undefined;
      if (
        !body?.runtimeId ||
        body.cpuPct === undefined ||
        body.memPct === undefined ||
        body.diskPct === undefined ||
        body.latencyMs === undefined
      ) {
        return apiError(
          res,
          'runtimeId, cpuPct, memPct, diskPct and latencyMs are required',
          400,
          'MISSING_FIELDS'
        );
      }
      const metric = fleetOpsStore.recordHeartbeat(body.runtimeId, {
        cpuPct: body.cpuPct,
        memPct: body.memPct,
        diskPct: body.diskPct,
        latencyMs: body.latencyMs,
      });
      if (!metric) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
      json(res, metric, 201);
    })
  );

  // POST /admin/fleet/runtime/:id/{restart,update,reinstall,sync-now,clear-cache,force-heartbeat,disable,enable}
  for (const action of REMOTE_ACTIONS) {
    router.post(
      `/admin/fleet/runtime/:id/${action.path}`,
      requirePermission(
        action.type === 'DISABLE' || action.type === 'ENABLE' ? 'runtime.update' : 'runtime.restart'
      )(async (ctx: RouteContext, res: ServerResponse) => {
        const id = ctx.params?.id as string;
        const command = fleetOpsStore.issueCommand(id, action.type, ctx.adminUserId);
        if (!command) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
        adminIdentityStore.recordAudit({
          action: 'RUNTIME_COMMAND',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: id,
          metadata: { command: action.type },
        });
        json(res, command);
      })
    );
  }
}
