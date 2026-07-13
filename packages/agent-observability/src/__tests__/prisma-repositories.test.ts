import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaHeartbeatRecordRepository } from '../infrastructure/prisma-heartbeat-record-repository.js';
import { PrismaSyncRecordRepository } from '../infrastructure/prisma-sync-record-repository.js';
import { HeartbeatRecord } from '../entity/heartbeat-record.js';
import { SyncRecord } from '../entity/sync-record.js';
import type { HeartbeatDbDelegate, SyncHistoryDbDelegate } from '../infrastructure/prisma-types.js';

const NOW = new Date('2025-01-01T12:00:00Z');
const AGO = new Date('2025-01-01T11:00:00Z');

// ─── Heartbeat Prisma repo ─────────────────────────────────────────────────

function makeHBRow(id = 'hb-1', agentId = 'agent-1') {
  return {
    id,
    agentId,
    receivedAt: NOW,
    version: '1.0.0',
    hostname: 'h',
    memoryUsage: null,
    uptime: null,
    queueSize: null,
    status: 'ONLINE',
  };
}

describe('PrismaHeartbeatRecordRepository', () => {
  let mockDb: HeartbeatDbDelegate;
  let repo: PrismaHeartbeatRecordRepository;

  beforeEach(() => {
    mockDb = { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() };
    repo = new PrismaHeartbeatRecordRepository(mockDb);
  });

  it('save calls db.create with correct data', async () => {
    vi.mocked(mockDb.create).mockResolvedValue(makeHBRow());
    const r = HeartbeatRecord.create({
      agentId: 'agent-1',
      receivedAt: NOW,
      version: '1.0.0',
      hostname: 'h',
      status: 'ONLINE',
    });
    await repo.save(r);
    expect(mockDb.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agentId: 'agent-1' }) })
    );
  });

  it('findByAgentId maps rows to HeartbeatRecord', async () => {
    vi.mocked(mockDb.findMany).mockResolvedValue([makeHBRow()]);
    const recs = await repo.findByAgentId('agent-1');
    expect(recs).toHaveLength(1);
    expect(recs[0]).toBeInstanceOf(HeartbeatRecord);
    expect(recs[0].agentId).toBe('agent-1');
  });

  it('findRecent passes gte filter', async () => {
    vi.mocked(mockDb.findMany).mockResolvedValue([]);
    await repo.findRecent(AGO);
    expect(mockDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ receivedAt: { gte: AGO } }) })
    );
  });

  it('countByAgentId delegates to db.count', async () => {
    vi.mocked(mockDb.count).mockResolvedValue(3);
    expect(await repo.countByAgentId('agent-1')).toBe(3);
  });

  it('deleteOldest skips db.deleteMany when nothing to delete', async () => {
    vi.mocked(mockDb.findMany).mockResolvedValue([makeHBRow('1'), makeHBRow('2')]);
    await repo.deleteOldest('agent-1', 10);
    expect(mockDb.deleteMany).not.toHaveBeenCalled();
  });

  it('deleteOldest calls deleteMany for excess rows', async () => {
    vi.mocked(mockDb.findMany).mockResolvedValue([makeHBRow('1'), makeHBRow('2'), makeHBRow('3')]);
    vi.mocked(mockDb.deleteMany).mockResolvedValue({ count: 1 });
    await repo.deleteOldest('agent-1', 2);
    expect(mockDb.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['3'] } } });
  });
});

// ─── Sync Prisma repo ─────────────────────────────────────────────────────

function makeSyncRow(id = 's-1', agentId = 'agent-1') {
  return {
    id,
    agentId,
    startedAt: AGO,
    finishedAt: NOW,
    durationMs: 3_600_000,
    recordsSent: 100,
    recordsFailed: 0,
    bytesTransferred: 1024,
    compressionRatio: null,
    result: 'SUCCESS',
  };
}

describe('PrismaSyncRecordRepository', () => {
  let mockDb: SyncHistoryDbDelegate;
  let repo: PrismaSyncRecordRepository;

  beforeEach(() => {
    mockDb = { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() };
    repo = new PrismaSyncRecordRepository(mockDb);
  });

  it('save calls db.create with correct data', async () => {
    vi.mocked(mockDb.create).mockResolvedValue(makeSyncRow());
    const r = SyncRecord.create({
      agentId: 'agent-1',
      startedAt: AGO,
      finishedAt: NOW,
      recordsSent: 100,
      recordsFailed: 0,
      bytesTransferred: 1024,
      result: 'SUCCESS',
    });
    await repo.save(r);
    expect(mockDb.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agentId: 'agent-1' }) })
    );
  });

  it('findByAgentId maps rows to SyncRecord', async () => {
    vi.mocked(mockDb.findMany).mockResolvedValue([makeSyncRow()]);
    const recs = await repo.findByAgentId('agent-1');
    expect(recs).toHaveLength(1);
    expect(recs[0]).toBeInstanceOf(SyncRecord);
  });

  it('findRecent passes gte filter on finishedAt', async () => {
    vi.mocked(mockDb.findMany).mockResolvedValue([]);
    await repo.findRecent(AGO);
    expect(mockDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ finishedAt: { gte: AGO } }) })
    );
  });

  it('deleteOldest calls deleteMany for excess rows', async () => {
    vi.mocked(mockDb.findMany).mockResolvedValue([
      makeSyncRow('1'),
      makeSyncRow('2'),
      makeSyncRow('3'),
    ]);
    vi.mocked(mockDb.deleteMany).mockResolvedValue({ count: 1 });
    await repo.deleteOldest('agent-1', 2);
    expect(mockDb.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['3'] } } });
  });
});
