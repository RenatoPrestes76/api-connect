import type { ServerResponse }           from 'node:http';
import type { RouteContext }             from '../../../http/router.js';
import { json, apiError }                from '../../../http/router.js';
import type { AtlasAgentRepository }     from '@seltriva/agent-identity';
import type { SyncRecordRepository }     from '@seltriva/agent-observability';
import {
  SyncRecord,
  DEFAULT_MAX_SYNCS_PER_AGENT,
} from '@seltriva/agent-observability';
import type { SyncResult }               from '@seltriva/agent-observability';

const VALID_RESULTS = new Set<string>(['SUCCESS', 'PARTIAL', 'FAILED']);

export function createSyncStatusHandler(
  agentRepo: AtlasAgentRepository,
  syncRepo:  SyncRecordRepository,
) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const agentId  = ctx.agentId!;
    const body     = (ctx.body ?? {}) as Record<string, unknown>;
    const finishedAt = new Date();

    const agent = await agentRepo.findById(agentId);
    if (!agent) {
      apiError(res, 'Agent not found', 404, 'NOT_FOUND');
      return;
    }

    if (agent.status.isDisabled()) {
      apiError(res, 'Agent is disabled', 403, 'AGENT_DISABLED');
      return;
    }

    try {
      if (agent.status.value === 'REGISTERING') agent.markHeartbeat();
      if (agent.status.value !== 'SYNCING')     agent.markSyncing();
      agent.markSynchronizationFinished();
    } catch {
      apiError(res, 'Agent is not in a syncable state', 409, 'INVALID_STATE');
      return;
    }

    await agentRepo.update(agent);

    // Persist sync history
    const resultRaw = body['result'] as string | undefined;
    const result: SyncResult = VALID_RESULTS.has(resultRaw ?? '') ? resultRaw as SyncResult : 'SUCCESS';
    const startedAtRaw = body['startedAt'] as string | undefined;
    const startedAt = startedAtRaw ? new Date(startedAtRaw) : new Date(finishedAt.getTime() - 1);

    const record = SyncRecord.create({
      agentId,
      startedAt,
      finishedAt,
      recordsSent:      Math.max(0, Number(body['recordsSent']     ?? 0)),
      recordsFailed:    Math.max(0, Number(body['recordsFailed']   ?? 0)),
      bytesTransferred: Math.max(0, Number(body['bytesTransferred'] ?? 0)),
      compressionRatio: body['compressionRatio'] != null ? Number(body['compressionRatio']) : null,
      result,
    });
    await syncRepo.save(record);
    const count = await syncRepo.countByAgentId(agentId);
    if (count > DEFAULT_MAX_SYNCS_PER_AGENT) {
      await syncRepo.deleteOldest(agentId, DEFAULT_MAX_SYNCS_PER_AGENT);
    }

    json(res, {
      data: {
        agentId:             agent.id.toString(),
        lastSynchronization: agent.lastSynchronization?.toISOString() ?? null,
      },
    });
  };
}
