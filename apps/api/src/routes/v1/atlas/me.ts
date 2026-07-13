import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import type { AtlasAgentRepository } from '@seltriva/agent-identity';

export function createMeHandler(agentRepo: AtlasAgentRepository) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const agentId = ctx.agentId!;

    const agent = await agentRepo.findById(agentId);
    if (!agent) {
      apiError(res, 'Agent not found', 404, 'NOT_FOUND');
      return;
    }

    json(res, {
      data: {
        agentId: agent.id.toString(),
        companyId: agent.companyId,
        name: agent.name,
        hostname: agent.hostname.toString(),
        machineId: agent.machineId.toString(),
        connectorType: agent.connectorType,
        version: agent.version.toString(),
        status: agent.status.value,
        lastHeartbeat: agent.lastHeartbeat?.toISOString() ?? null,
        lastSynchronization: agent.lastSynchronization?.toISOString() ?? null,
        createdAt: agent.createdAt.toISOString(),
      },
    });
  };
}
