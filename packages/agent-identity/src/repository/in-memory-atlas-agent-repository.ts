/**
 * InMemoryAtlasAgentRepository — Map-backed implementation for testing and
 * local development. Not suitable for production (no persistence, no locking).
 */
import { AtlasAgent, AtlasAgentSnapshot } from '../entity/atlas-agent.js';
import { AgentStatusKind }                from '../value-objects/agent-status.js';
import type { AtlasAgentRepository }       from './atlas-agent-repository.js';

export class InMemoryAtlasAgentRepository implements AtlasAgentRepository {
  private readonly _store = new Map<string, AtlasAgentSnapshot>();

  async save(agent: AtlasAgent): Promise<void> {
    const id = agent.id.toString();
    if (this._store.has(id)) {
      throw new RepositoryError(`Agent with id "${id}" already exists`);
    }
    this._store.set(id, agent.toSnapshot());
  }

  async update(agent: AtlasAgent): Promise<void> {
    const id = agent.id.toString();
    if (!this._store.has(id)) {
      throw new RepositoryError(`Agent with id "${id}" not found`);
    }
    this._store.set(id, agent.toSnapshot());
  }

  async findById(id: string): Promise<AtlasAgent | null> {
    const snap = this._store.get(id);
    return snap ? AtlasAgent.fromSnapshot(snap) : null;
  }

  async findByMachineId(machineId: string): Promise<AtlasAgent | null> {
    for (const snap of this._store.values()) {
      if (snap.machineId === machineId) {
        return AtlasAgent.fromSnapshot(snap);
      }
    }
    return null;
  }

  async findByCompany(companyId: string): Promise<AtlasAgent[]> {
    const results: AtlasAgent[] = [];
    for (const snap of this._store.values()) {
      if (snap.companyId === companyId) {
        results.push(AtlasAgent.fromSnapshot(snap));
      }
    }
    return results;
  }

  async findAll(): Promise<AtlasAgent[]> {
    return Array.from(this._store.values()).map(AtlasAgent.fromSnapshot);
  }

  async findOnline(): Promise<AtlasAgent[]> {
    const results: AtlasAgent[] = [];
    for (const snap of this._store.values()) {
      if (snap.status === AgentStatusKind.ONLINE) {
        results.push(AtlasAgent.fromSnapshot(snap));
      }
    }
    return results;
  }

  async delete(id: string): Promise<void> {
    this._store.delete(id);
  }

  /** Test helper — total number of stored agents. */
  get size(): number { return this._store.size; }

  /** Test helper — clear all stored agents. */
  clear(): void { this._store.clear(); }
}

export class RepositoryError extends Error {
  readonly code = 'REPOSITORY_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}
