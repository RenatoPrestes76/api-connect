import { AgentVersion } from '@seltriva/agent-identity';
import type { AtlasAgentRepository } from '@seltriva/agent-identity';

export type UpdateAgentVersionError =
  | { code: 'AGENT_NOT_FOUND';    agentId: string }
  | { code: 'AGENT_DISABLED';     agentId: string }
  | { code: 'VERSION_NOT_NEWER';  current: string; requested: string };

export type UpdateAgentVersionOutput =
  | { ok: true;  value: { agentId: string; version: string } }
  | { ok: false; error: UpdateAgentVersionError };

export class UpdateAgentVersion {
  constructor(private readonly _repo: AtlasAgentRepository) {}

  async execute(agentId: string, newVersion: string): Promise<UpdateAgentVersionOutput> {
    const agent = await this._repo.findById(agentId);
    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', agentId } };
    }

    if (agent.status.isDisabled()) {
      return { ok: false, error: { code: 'AGENT_DISABLED', agentId } };
    }

    let version: AgentVersion;
    try {
      version = AgentVersion.fromString(newVersion);
    } catch {
      return {
        ok: false,
        error: {
          code:      'VERSION_NOT_NEWER',
          current:   agent.version.toString(),
          requested: newVersion,
        },
      };
    }

    try {
      agent.updateVersion(version);
    } catch {
      return {
        ok: false,
        error: {
          code:      'VERSION_NOT_NEWER',
          current:   agent.version.toString(),
          requested: newVersion,
        },
      };
    }

    await this._repo.update(agent);
    agent.pullEvents();

    return { ok: true, value: { agentId, version: version.toString() } };
  }
}
