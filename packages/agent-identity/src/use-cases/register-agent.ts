import { AtlasAgent, RegisterAgentParams } from '../entity/atlas-agent.js';
import type { AtlasAgentRepository } from '../repository/atlas-agent-repository.js';
import type { AgentDomainEvent } from '../events/agent-events.js';

export interface RegisterAgentResult {
  readonly agentId: string;
  readonly events: readonly AgentDomainEvent[];
}

export type RegisterAgentError =
  | { code: 'MACHINE_ALREADY_REGISTERED'; machineId: string }
  | { code: 'VALIDATION_ERROR'; message: string };

export type RegisterAgentOutput =
  | { ok: true; value: RegisterAgentResult }
  | { ok: false; error: RegisterAgentError };

export class RegisterAgent {
  constructor(private readonly _repo: AtlasAgentRepository) {}

  async execute(params: RegisterAgentParams): Promise<RegisterAgentOutput> {
    // Prevent duplicate agents for the same machine
    const existing = await this._repo.findByMachineId(params.machineId);
    if (existing) {
      return {
        ok: false,
        error: { code: 'MACHINE_ALREADY_REGISTERED', machineId: params.machineId },
      };
    }

    let agent: AtlasAgent;
    try {
      agent = AtlasAgent.register(params);
    } catch (err) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: (err as Error).message },
      };
    }

    await this._repo.save(agent);
    const events = agent.pullEvents();
    return { ok: true, value: { agentId: agent.id.toString(), events } };
  }
}
