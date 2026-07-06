import { HeartbeatRecord, type HeartbeatRecordSnapshot } from '../entity/heartbeat-record.js';
import type { HeartbeatRecordRepository }                 from './heartbeat-record-repository.js';

export class InMemoryHeartbeatRecordRepository implements HeartbeatRecordRepository {
  private readonly _store: HeartbeatRecordSnapshot[] = [];

  async save(record: HeartbeatRecord): Promise<void> {
    this._store.push(record.toSnapshot());
  }

  async findByAgentId(agentId: string, limit?: number): Promise<HeartbeatRecord[]> {
    const all = this._store
      .filter(s => s.agentId === agentId)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const slice = limit ? all.slice(0, limit) : all;
    return slice.map(HeartbeatRecord.fromSnapshot);
  }

  async findRecent(since: Date, limit?: number): Promise<HeartbeatRecord[]> {
    const all = this._store
      .filter(s => s.receivedAt >= since)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const slice = limit ? all.slice(0, limit) : all;
    return slice.map(HeartbeatRecord.fromSnapshot);
  }

  async countByAgentId(agentId: string): Promise<number> {
    return this._store.filter(s => s.agentId === agentId).length;
  }

  async deleteOldest(agentId: string, keepCount: number): Promise<void> {
    const indices = this._store
      .map((s, i) => ({ i, t: s.receivedAt.getTime(), agentId: s.agentId }))
      .filter(x => x.agentId === agentId)
      .sort((a, b) => b.t - a.t)   // newest first
      .slice(keepCount)             // everything beyond keepCount
      .map(x => x.i)
      .sort((a, b) => b - a);      // descending index order for safe splice

    for (const idx of indices) {
      this._store.splice(idx, 1);
    }
  }

  get size(): number { return this._store.length; }
  clear(): void      { this._store.length = 0; }
}
