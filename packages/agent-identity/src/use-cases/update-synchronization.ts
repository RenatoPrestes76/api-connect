import type { AtlasAgentRepository } from '../repository/atlas-agent-repository.js';
import type { AgentDomainEvent } from '../events/agent-events.js';

export interface UpdateSynchronizationResult {
  readonly agentId: string;
  readonly synchronizedAt: Date;
  readonly events: readonly AgentDomainEvent[];
}

export type UpdateSynchronizationError =
  | { code: 'AGENT_NOT_FOUND'; agentId: string }
  | { code: 'AGENT_DISABLED'; agentId: string }
  | { code: 'AGENT_NOT_SYNCING'; agentId: string; currentStatus: string };

export type UpdateSynchronizationOutput =
  | { ok: true; value: UpdateSynchronizationResult }
  | { ok: false; error: UpdateSynchronizationError };

export class UpdateSynchronization {
  constructor(private readonly _repo: AtlasAgentRepository) {}

  async execute(agentId: string): Promise<UpdateSynchronizationOutput> {
    const agent = await this._repo.findById(agentId);
    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', agentId } };
    }

    if (agent.status.isDisabled()) {
      return { ok: false, error: { code: 'AGENT_DISABLED', agentId } };
    }

    if (!agent.status.isSyncing()) {
      return {
        ok: false,
        error: {
          code: 'AGENT_NOT_SYNCING',
          agentId,
          currentStatus: agent.status.value,
        },
      };
    }

    agent.markSynchronizationFinished();
    await this._repo.update(agent);

    const events = agent.pullEvents();
    return {
      ok: true,
      value: {
        agentId,
        synchronizedAt: agent.lastSynchronization!,
        events,
      },
    };
  }
}
