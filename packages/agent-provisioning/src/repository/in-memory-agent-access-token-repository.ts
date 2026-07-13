import { AgentAccessToken, AgentAccessTokenSnapshot } from '../entity/agent-access-token.js';
import type { AgentAccessTokenRepository } from './agent-access-token-repository.js';

export class InMemoryAgentAccessTokenRepository implements AgentAccessTokenRepository {
  private readonly _store = new Map<string, AgentAccessTokenSnapshot>();

  async save(token: AgentAccessToken): Promise<void> {
    for (const snap of this._store.values()) {
      if (snap.tokenHash === token.tokenHash) {
        throw new Error(`AgentAccessToken with hash "${token.tokenHash}" already exists`);
      }
    }
    this._store.set(token.id, token.toSnapshot());
  }

  async findByHash(tokenHash: string): Promise<AgentAccessToken | null> {
    for (const snap of this._store.values()) {
      if (snap.tokenHash === tokenHash) {
        return AgentAccessToken.fromSnapshot(snap);
      }
    }
    return null;
  }

  async findByAgentId(agentId: string): Promise<AgentAccessToken[]> {
    const results: AgentAccessToken[] = [];
    for (const snap of this._store.values()) {
      if (snap.agentId === agentId) {
        results.push(AgentAccessToken.fromSnapshot(snap));
      }
    }
    return results;
  }

  async updateLastUsed(id: string, lastUsedAt: Date): Promise<void> {
    const snap = this._store.get(id);
    if (!snap) throw new Error(`AgentAccessToken "${id}" not found`);
    this._store.set(id, { ...snap, lastUsedAt, updatedAt: new Date() });
  }

  async revoke(id: string): Promise<void> {
    const snap = this._store.get(id);
    if (!snap) throw new Error(`AgentAccessToken "${id}" not found`);
    const token = AgentAccessToken.fromSnapshot(snap);
    token.revoke();
    this._store.set(id, token.toSnapshot());
  }

  /** Test helper */
  get size(): number {
    return this._store.size;
  }

  /** Test helper */
  clear(): void {
    this._store.clear();
  }
}
