import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { clusterManager } from '../../../modules/ha/cluster-manager.js';
import { haStore } from '../../../modules/ha/ha-store.js';
import type { NodeRole, NodeStatus } from '../../../modules/ha/types.js';

const VALID_ROLES: NodeRole[] = ['leader', 'secondary', 'standby', 'worker'];
const VALID_STATUSES: NodeStatus[] = ['online', 'degraded', 'failover', 'recovering', 'offline'];

export function registerHaClusterRoutes(router: { get: Function }): void {
  router.get('/api/v1/ha/cluster', (_ctx: RouteContext, res: ServerResponse) => {
    const overview = clusterManager.getOverview();
    json(res, overview);
  });

  router.get('/api/v1/ha/nodes', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const role = ctx.query.get('role') ?? undefined;

    if (status && !VALID_STATUSES.includes(status as NodeStatus)) {
      return apiError(
        res,
        `status must be one of: ${VALID_STATUSES.join(', ')}`,
        400,
        'INVALID_STATUS'
      );
    }
    if (role && !VALID_ROLES.includes(role as NodeRole)) {
      return apiError(res, `role must be one of: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
    }

    const nodes = haStore.getNodesWithReplication({
      status: status as NodeStatus | undefined,
      role: role as NodeRole | undefined,
    });
    const replication = haStore.getReplicationStates();

    json(res, {
      total: nodes.length,
      nodes,
      replicationSummary: {
        totalReplicas: replication.length,
        inSync: replication.filter((r) => r.status === 'in_sync').length,
        lagging: replication.filter((r) => r.status === 'lagging').length,
        stopped: replication.filter((r) => r.status === 'stopped').length,
      },
    });
  });
}
