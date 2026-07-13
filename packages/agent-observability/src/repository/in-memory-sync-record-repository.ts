import { SyncRecord, type SyncRecordSnapshot } from '../entity/sync-record.js';
import type { SyncRecordRepository } from './sync-record-repository.js';

export class InMemorySyncRecordRepository implements SyncRecordRepository {
  private readonly _store: SyncRecordSnapshot[] = [];

  async save(record: SyncRecord): Promise<void> {
    this._store.push(record.toSnapshot());
  }

  async findByAgentId(agentId: string, limit?: number): Promise<SyncRecord[]> {
    const all = this._store
      .filter((s) => s.agentId === agentId)
      .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
    const slice = limit ? all.slice(0, limit) : all;
    return slice.map(SyncRecord.fromSnapshot);
  }

  async findRecent(since: Date, limit?: number): Promise<SyncRecord[]> {
    const all = this._store
      .filter((s) => s.finishedAt >= since)
      .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
    const slice = limit ? all.slice(0, limit) : all;
    return slice.map(SyncRecord.fromSnapshot);
  }

  async countByAgentId(agentId: string): Promise<number> {
    return this._store.filter((s) => s.agentId === agentId).length;
  }

  async deleteOldest(agentId: string, keepCount: number): Promise<void> {
    const indices = this._store
      .map((s, i) => ({ i, t: s.finishedAt.getTime(), agentId: s.agentId }))
      .filter((x) => x.agentId === agentId)
      .sort((a, b) => b.t - a.t)
      .slice(keepCount)
      .map((x) => x.i)
      .sort((a, b) => b - a);

    for (const idx of indices) {
      this._store.splice(idx, 1);
    }
  }

  get size(): number {
    return this._store.length;
  }
  clear(): void {
    this._store.length = 0;
  }
}
