import type { AtlasAgent } from '../entity/atlas-agent.js';
import type { AtlasAgentRepository } from '../repository/atlas-agent-repository.js';

export type FindAgentError = { code: 'AGENT_NOT_FOUND'; agentId: string };

export type FindAgentOutput =
  | { ok: true; value: AtlasAgent }
  | { ok: false; error: FindAgentError };

export type FindAgentsByCompanyOutput =
  | { ok: true; value: AtlasAgent[] }
  | { ok: false; error: never };

export class FindAgent {
  constructor(private readonly _repo: AtlasAgentRepository) {}

  async byId(agentId: string): Promise<FindAgentOutput> {
    const agent = await this._repo.findById(agentId);
    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', agentId } };
    }
    return { ok: true, value: agent };
  }

  async byCompany(companyId: string): Promise<FindAgentsByCompanyOutput> {
    const agents = await this._repo.findByCompany(companyId);
    return { ok: true, value: agents };
  }

  async online(): Promise<{ ok: true; value: AtlasAgent[] }> {
    const agents = await this._repo.findOnline();
    return { ok: true, value: agents };
  }

  async byMachineId(machineId: string): Promise<FindAgentOutput | { ok: true; value: AtlasAgent }> {
    const agent = await this._repo.findByMachineId(machineId);
    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', agentId: machineId } };
    }
    return { ok: true, value: agent };
  }
}
