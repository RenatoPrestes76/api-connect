import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryHeartbeatRecordRepository } from '../repository/in-memory-heartbeat-record-repository.js';
import { InMemorySyncRecordRepository }      from '../repository/in-memory-sync-record-repository.js';
import { HeartbeatRecord }                   from '../entity/heartbeat-record.js';
import { SyncRecord }                        from '../entity/sync-record.js';

// ─── Heartbeat repo ───────────────────────────────────────────────────────────

function makeHB(agentId: string, minsAgo: number, id?: string): HeartbeatRecord {
  return HeartbeatRecord.create({
    id,
    agentId,
    receivedAt: new Date(Date.now() - minsAgo * 60_000),
    version: '1.0.0',
    hostname: 'host.local',
    status: 'ONLINE',
  });
}

describe('InMemoryHeartbeatRecordRepository', () => {
  let repo: InMemoryHeartbeatRecordRepository;
  beforeEach(() => { repo = new InMemoryHeartbeatRecordRepository(); });

  it('save and findByAgentId returns records sorted newest-first', async () => {
    await repo.save(makeHB('ag', 5, 'old'));
    await repo.save(makeHB('ag', 1, 'new'));
    const recs = await repo.findByAgentId('ag');
    expect(recs[0].id).toBe('new');
    expect(recs[1].id).toBe('old');
  });

  it('findByAgentId respects limit', async () => {
    for (let i = 0; i < 5; i++) await repo.save(makeHB('ag', i));
    const recs = await repo.findByAgentId('ag', 3);
    expect(recs).toHaveLength(3);
  });

  it('findByAgentId returns empty array when agent has no records', async () => {
    expect(await repo.findByAgentId('nobody')).toEqual([]);
  });

  it('findRecent returns only records after since', async () => {
    const since = new Date(Date.now() - 3 * 60_000);
    await repo.save(makeHB('ag', 10)); // 10 min ago — excluded
    await repo.save(makeHB('ag', 1));  // 1 min ago  — included
    const recs = await repo.findRecent(since);
    expect(recs).toHaveLength(1);
  });

  it('findRecent returns records from multiple agents', async () => {
    const since = new Date(Date.now() - 5 * 60_000);
    await repo.save(makeHB('ag1', 1));
    await repo.save(makeHB('ag2', 2));
    expect(await repo.findRecent(since)).toHaveLength(2);
  });

  it('countByAgentId counts only the given agent', async () => {
    await repo.save(makeHB('ag1', 1));
    await repo.save(makeHB('ag1', 2));
    await repo.save(makeHB('ag2', 1));
    expect(await repo.countByAgentId('ag1')).toBe(2);
    expect(await repo.countByAgentId('ag2')).toBe(1);
  });

  it('deleteOldest keeps the most recent N records', async () => {
    for (let i = 0; i < 5; i++) await repo.save(makeHB('ag', i, `hb-${i}`));
    await repo.deleteOldest('ag', 3);
    expect(await repo.countByAgentId('ag')).toBe(3);
    // remaining should be the 3 most recent
    const remaining = await repo.findByAgentId('ag');
    expect(remaining.every(r => ['hb-0', 'hb-1', 'hb-2'].includes(r.id))).toBe(true);
  });

  it('deleteOldest is a no-op when count <= keepCount', async () => {
    await repo.save(makeHB('ag', 1, 'x'));
    await repo.deleteOldest('ag', 500);
    expect(await repo.countByAgentId('ag')).toBe(1);
  });

  it('clear() empties the repo', async () => {
    await repo.save(makeHB('ag', 1));
    repo.clear();
    expect(repo.size).toBe(0);
  });

  it('size reflects total across all agents', async () => {
    await repo.save(makeHB('a1', 1));
    await repo.save(makeHB('a2', 1));
    expect(repo.size).toBe(2);
  });
});

// ─── Sync repo ────────────────────────────────────────────────────────────────

function makeSync(agentId: string, minsAgo: number, id?: string): SyncRecord {
  const end   = new Date(Date.now() - minsAgo * 60_000);
  const start = new Date(end.getTime() - 5_000);
  return SyncRecord.create({
    id,
    agentId,
    startedAt:       start,
    finishedAt:      end,
    recordsSent:     100,
    recordsFailed:   0,
    bytesTransferred: 10_240,
    result: 'SUCCESS',
  });
}

describe('InMemorySyncRecordRepository', () => {
  let repo: InMemorySyncRecordRepository;
  beforeEach(() => { repo = new InMemorySyncRecordRepository(); });

  it('save and findByAgentId returns records sorted newest-first', async () => {
    await repo.save(makeSync('ag', 5, 'old'));
    await repo.save(makeSync('ag', 1, 'new'));
    const recs = await repo.findByAgentId('ag');
    expect(recs[0].id).toBe('new');
  });

  it('findRecent filters by finishedAt', async () => {
    const since = new Date(Date.now() - 3 * 60_000);
    await repo.save(makeSync('ag', 10)); // excluded
    await repo.save(makeSync('ag', 1));  // included
    const recs = await repo.findRecent(since);
    expect(recs).toHaveLength(1);
  });

  it('countByAgentId works independently per agent', async () => {
    await repo.save(makeSync('ag1', 1));
    await repo.save(makeSync('ag1', 2));
    await repo.save(makeSync('ag2', 1));
    expect(await repo.countByAgentId('ag1')).toBe(2);
  });

  it('deleteOldest trims to keepCount', async () => {
    for (let i = 0; i < 4; i++) await repo.save(makeSync('ag', i, `s-${i}`));
    await repo.deleteOldest('ag', 2);
    expect(await repo.countByAgentId('ag')).toBe(2);
  });

  it('clear() empties all records', async () => {
    await repo.save(makeSync('ag', 1));
    repo.clear();
    expect(repo.size).toBe(0);
  });
});
