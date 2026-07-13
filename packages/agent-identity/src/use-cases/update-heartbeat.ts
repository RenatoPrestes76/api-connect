import type { AtlasAgentRepository } from '../repository/atlas-agent-repository.js';
import type { AgentDomainEvent } from '../events/agent-events.js';

export interface UpdateHeartbeatResult {
  readonly agentId: string;
  readonly heartbeatAt: Date;
  readonly events: readonly AgentDomainEvent[];
}

export type UpdateHeartbeatError =
  | { code: 'AGENT_NOT_FOUND'; agentId: string }
  | { code: 'AGENT_DISABLED'; agentId: string };

export type UpdateHeartbeatOutput =
  | { ok: true; value: UpdateHeartbeatResult }
  | { ok: false; error: UpdateHeartbeatError };

export class UpdateHeartbeat {
  constructor(private readonly _repo: AtlasAgentRepository) {}

  async execute(agentId: string): Promise<UpdateHeartbeatOutput> {
    const agent = await this._repo.findById(agentId);
    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', agentId } };
    }

    if (agent.status.isDisabled()) {
      return { ok: false, error: { code: 'AGENT_DISABLED', agentId } };
    }

    agent.markHeartbeat();
    await this._repo.update(agent);

    const events = agent.pullEvents();
    return {
      ok: true,
      value: {
        agentId,
        heartbeatAt: agent.lastHeartbeat!,
        events,
      },
    };
  }
}
