import type { ServerResponse }             from 'node:http';
import type { RouteContext }               from '../../../http/router.js';
import { json, apiError }                  from '../../../http/router.js';
import type { AtlasAgentRepository }       from '@seltriva/agent-identity';
import { Hostname, AgentVersion }          from '@seltriva/agent-identity';
import type { HeartbeatRecordRepository }  from '@seltriva/agent-observability';
import {
  HeartbeatRecord,
  computeHealth,
  DEFAULT_MAX_HEARTBEATS_PER_AGENT,
} from '@seltriva/agent-observability';

export function createHeartbeatHandler(
  agentRepo:     AtlasAgentRepository,
  heartbeatRepo: HeartbeatRecordRepository,
) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const agentId = ctx.agentId!;
    const body    = ctx.body as Record<string, unknown> | undefined;

    const agent = await agentRepo.findById(agentId);
    if (!agent) {
      apiError(res, 'Agent not found', 404, 'NOT_FOUND');
      return;
    }

    // Optional hostname update
    const hostnameStr = body?.['hostname'] as string | undefined;
    if (hostnameStr) {
      try { agent.updateHostname(Hostname.fromString(hostnameStr)); } catch { /* ignore */ }
    }

    // Optional version update (only if strictly newer)
    const versionStr = body?.['version'] as string | undefined;
    if (versionStr) {
      try {
        const newVer = AgentVersion.fromString(versionStr);
        if (newVer.isNewerThan(agent.version)) agent.updateVersion(newVer);
      } catch { /* ignore */ }
    }

    agent.markHeartbeat();
    if (!agent.status.isDisabled() && agent.status.value !== 'ONLINE') {
      agent.markOnline();
    }

    await agentRepo.update(agent);

    // Persist heartbeat history
    const record = HeartbeatRecord.create({
      agentId:   agent.id.toString(),
      receivedAt: new Date(),
      version:   agent.version.toString(),
      hostname:  agent.hostname.toString(),
      memoryUsage: (body?.['memoryUsage'] as number | undefined) ?? null,
      uptime:      (body?.['uptime']      as number | undefined) ?? null,
      queueSize:   (body?.['queueSize']   as number | undefined) ?? null,
      status:      computeHealth(agent.lastHeartbeat),
    });
    await heartbeatRepo.save(record);
    const count = await heartbeatRepo.countByAgentId(agentId);
    if (count > DEFAULT_MAX_HEARTBEATS_PER_AGENT) {
      await heartbeatRepo.deleteOldest(agentId, DEFAULT_MAX_HEARTBEATS_PER_AGENT);
    }

    json(res, {
      data: {
        agentId:       agent.id.toString(),
        status:        agent.status.value,
        lastHeartbeat: agent.lastHeartbeat?.toISOString() ?? null,
      },
    });
  };
}
