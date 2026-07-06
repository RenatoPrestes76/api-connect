import type { AgentAccessToken } from '../entity/agent-access-token.js';

export interface AgentAccessTokenRepository {
  save(token: AgentAccessToken): Promise<void>;
  findByHash(tokenHash: string): Promise<AgentAccessToken | null>;
  findByAgentId(agentId: string): Promise<AgentAccessToken[]>;
  updateLastUsed(id: string, lastUsedAt: Date): Promise<void>;
  revoke(id: string): Promise<void>;
}
