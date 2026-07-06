import { SyncRecord, type SyncRecordSnapshot } from '../entity/sync-record.js';
import type { SyncRecordRepository }             from '../repository/sync-record-repository.js';
import type { SyncHistoryDbDelegate }             from './prisma-types.js';

export class PrismaSyncRecordRepository implements SyncRecordRepository {
  constructor(private readonly _db: SyncHistoryDbDelegate) {}

  async save(record: SyncRecord): Promise<void> {
    const s = record.toSnapshot();
    await this._db.create({
      data: {
        id: s.id, agentId: s.agentId, startedAt: s.startedAt, finishedAt: s.finishedAt,
        durationMs: s.durationMs, recordsSent: s.recordsSent, recordsFailed: s.recordsFailed,
        bytesTransferred: s.bytesTransferred, compressionRatio: s.compressionRatio,
        result: s.result,
      },
    });
  }

  async findByAgentId(agentId: string, limit?: number): Promise<SyncRecord[]> {
    const rows = await this._db.findMany({
      where: { agentId },
      orderBy: { finishedAt: 'desc' },
      take: limit,
    });
    return rows.map(r => SyncRecord.fromSnapshot(this._toDomain(r)));
  }

  async findRecent(since: Date, limit?: number): Promise<SyncRecord[]> {
    const rows = await this._db.findMany({
      where: { finishedAt: { gte: since } },
      orderBy: { finishedAt: 'desc' },
      take: limit,
    });
    return rows.map(r => SyncRecord.fromSnapshot(this._toDomain(r)));
  }

  async countByAgentId(agentId: string): Promise<number> {
    return this._db.count({ where: { agentId } });
  }

  async deleteOldest(agentId: string, keepCount: number): Promise<void> {
    const all = await this._db.findMany({
      where: { agentId }, orderBy: { finishedAt: 'desc' },
    });
    const toDelete = all.slice(keepCount).map(r => r.id);
    if (toDelete.length > 0) {
      await this._db.deleteMany({ where: { id: { in: toDelete } } });
    }
  }

  private _toDomain(r: { id: string; agentId: string; startedAt: Date; finishedAt: Date; durationMs: number; recordsSent: number; recordsFailed: number; bytesTransferred: number; compressionRatio: number | null; result: string }): SyncRecordSnapshot {
    return { ...r, result: r.result as SyncRecord['result'] };
  }
}
