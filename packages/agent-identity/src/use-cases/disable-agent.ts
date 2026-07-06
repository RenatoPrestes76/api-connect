import type { AtlasAgentRepository } from '../repository/atlas-agent-repository.js';
import type { AgentDomainEvent }       from '../events/agent-events.js';

export interface DisableAgentResult {
  readonly agentId:    string;
  readonly disabledAt: Date;
  readonly events:     readonly AgentDomainEvent[];
}

export type DisableAgentError =
  | { code: 'AGENT_NOT_FOUND'; agentId: string };

export type DisableAgentOutput =
  | { ok: true;  value: DisableAgentResult }
  | { ok: false; error: DisableAgentError };

export class DisableAgent {
  constructor(private readonly _repo: AtlasAgentRepository) {}

  async execute(agentId: string): Promise<DisableAgentOutput> {
    const agent = await this._repo.findById(agentId);
    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', agentId } };
    }

    // disable() is idempotent — safe to call even if already disabled
    agent.disable();
    await this._repo.update(agent);

    const events = agent.pullEvents();
    return {
      ok: true,
      value: {
        agentId,
        disabledAt: agent.updatedAt,
        events,
      },
    };
  }
}
