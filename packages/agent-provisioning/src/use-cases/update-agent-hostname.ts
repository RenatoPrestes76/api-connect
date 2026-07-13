import { Hostname } from '@seltriva/agent-identity';
import type { AtlasAgentRepository } from '@seltriva/agent-identity';

export type UpdateAgentHostnameError =
  | { code: 'AGENT_NOT_FOUND'; agentId: string }
  | { code: 'AGENT_DISABLED'; agentId: string }
  | { code: 'INVALID_HOSTNAME'; hostname: string; reason: string };

export type UpdateAgentHostnameOutput =
  | { ok: true; value: { agentId: string; hostname: string } }
  | { ok: false; error: UpdateAgentHostnameError };

export class UpdateAgentHostname {
  constructor(private readonly _repo: AtlasAgentRepository) {}

  async execute(agentId: string, newHostname: string): Promise<UpdateAgentHostnameOutput> {
    const agent = await this._repo.findById(agentId);
    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', agentId } };
    }

    if (agent.status.isDisabled()) {
      return { ok: false, error: { code: 'AGENT_DISABLED', agentId } };
    }

    let hostname: Hostname;
    try {
      hostname = Hostname.fromString(newHostname);
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'INVALID_HOSTNAME',
          hostname: newHostname,
          reason: (err as Error).message,
        },
      };
    }

    agent.updateHostname(hostname);
    await this._repo.update(agent);
    agent.pullEvents();

    return { ok: true, value: { agentId, hostname: hostname.toString() } };
  }
}
