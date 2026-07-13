import { HeartbeatRecord, type HeartbeatRecordSnapshot } from '../entity/heartbeat-record.js';
import type { HeartbeatRecordRepository } from '../repository/heartbeat-record-repository.js';
import type { HeartbeatDbDelegate } from './prisma-types.js';

export class PrismaHeartbeatRecordRepository implements HeartbeatRecordRepository {
  constructor(private readonly _db: HeartbeatDbDelegate) {}

  async save(record: HeartbeatRecord): Promise<void> {
    const s = record.toSnapshot();
    await this._db.create({
      data: {
        id: s.id,
        agentId: s.agentId,
        receivedAt: s.receivedAt,
        version: s.version,
        hostname: s.hostname,
        memoryUsage: s.memoryUsage,
        uptime: s.uptime,
        queueSize: s.queueSize,
        status: s.status,
      },
    });
  }

  async findByAgentId(agentId: string, limit?: number): Promise<HeartbeatRecord[]> {
    const rows = await this._db.findMany({
      where: { agentId },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => HeartbeatRecord.fromSnapshot(this._toDomain(r)));
  }

  async findRecent(since: Date, limit?: number): Promise<HeartbeatRecord[]> {
    const rows = await this._db.findMany({
      where: { receivedAt: { gte: since } },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => HeartbeatRecord.fromSnapshot(this._toDomain(r)));
  }

  async countByAgentId(agentId: string): Promise<number> {
    return this._db.count({ where: { agentId } });
  }

  async deleteOldest(agentId: string, keepCount: number): Promise<void> {
    const all = await this._db.findMany({
      where: { agentId },
      orderBy: { receivedAt: 'desc' },
    });
    const toDelete = all.slice(keepCount).map((r) => r.id);
    if (toDelete.length > 0) {
      await this._db.deleteMany({ where: { id: { in: toDelete } } });
    }
  }

  private _toDomain(r: {
    id: string;
    agentId: string;
    receivedAt: Date;
    version: string;
    hostname: string;
    memoryUsage: number | null;
    uptime: number | null;
    queueSize: number | null;
    status: string;
  }): HeartbeatRecordSnapshot {
    return {
      id: r.id,
      agentId: r.agentId,
      receivedAt: r.receivedAt,
      version: r.version,
      hostname: r.hostname,
      memoryUsage: r.memoryUsage,
      uptime: r.uptime,
      queueSize: r.queueSize,
      status: r.status,
    };
  }
}
