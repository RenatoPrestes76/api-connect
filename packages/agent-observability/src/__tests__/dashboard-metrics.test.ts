import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID }                             from 'node:crypto';
import { DashboardMetricsService }               from '../services/dashboard-metrics-service.js';
import { InMemoryHeartbeatRecordRepository }      from '../repository/in-memory-heartbeat-record-repository.js';
import { InMemorySyncRecordRepository }           from '../repository/in-memory-sync-record-repository.js';
import { HeartbeatRecord }                        from '../entity/heartbeat-record.js';
import { SyncRecord }                             from '../entity/sync-record.js';
import type { AtlasAgentRepository }              from '@seltriva/agent-identity';
import { AtlasAgent, AgentStatusKind }            from '@seltriva/agent-identity';

function makeAgent(companyId: string, lastHeartbeat: Date | null): AtlasAgent {
  const snap = {
    id: randomUUID(),
    companyId,
    name: 'Agent',
    hostname: 'h',
    machineId: randomUUID(),
    connectorType: 'MSSQL',
    version: '1.0.0',
    status: AgentStatusKind.ONLINE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastHeartbeat,
    lastSynchronization: null,
  };
  return AtlasAgent.fromSnapshot(snap);
}

function makeSync(agentId: string, minsAgo: number): SyncRecord {
  const end   = new Date(Date.now() - minsAgo * 60_000);
  const start = new Date(end.getTime() - 5_000);
  return SyncRecord.create({ agentId, startedAt: start, finishedAt: end, recordsSent: 10, recordsFailed: 0, bytesTransferred: 1024, result: 'SUCCESS' });
}

describe('DashboardMetricsService.getMetrics', () => {
  let agentRepo:     AtlasAgentRepository;
  let heartbeatRepo: InMemoryHeartbeatRecordRepository;
  let syncRepo:      InMemorySyncRecordRepository;
  let service:       DashboardMetricsService;

  beforeEach(() => {
    agentRepo     = { findAll: vi.fn(), save: vi.fn(), update: vi.fn(), findById: vi.fn(), findByMachineId: vi.fn(), findByCompany: vi.fn(), findOnline: vi.fn(), delete: vi.fn() };
    heartbeatRepo = new InMemoryHeartbeatRecordRepository();
    syncRepo      = new InMemorySyncRecordRepository();
    service       = new DashboardMetricsService(agentRepo, syncRepo, heartbeatRepo);
  });

  it('returns zero metrics when no agents or syncs', async () => {
    vi.mocked(agentRepo.findAll).mockResolvedValue([]);
    const m = await service.getMetrics();
    expect(m).toEqual({ companies: 0, agents: 0, online: 0, stale: 0, offline: 0, last24hSynchronizations: 0 });
  });

  it('counts distinct companies', async () => {
    vi.mocked(agentRepo.findAll).mockResolvedValue([
      makeAgent('co-A', null),
      makeAgent('co-A', null),
      makeAgent('co-B', null),
    ]);
    const m = await service.getMetrics();
    expect(m.companies).toBe(2);
    expect(m.agents).toBe(3);
  });

  it('classifies ONLINE agents correctly', async () => {
    const recent  = new Date(Date.now() - 30_000);    // 30s ago — ONLINE
    const medium  = new Date(Date.now() - 5 * 60_000); // 5m ago  — STALE
    const ancient = new Date(Date.now() - 30 * 60_000); // 30m ago — OFFLINE
    vi.mocked(agentRepo.findAll).mockResolvedValue([
      makeAgent('co', recent),
      makeAgent('co', medium),
      makeAgent('co', ancient),
      makeAgent('co', null), // no heartbeat — OFFLINE
    ]);
    const m = await service.getMetrics();
    expect(m.online).toBe(1);
    expect(m.stale).toBe(1);
    expect(m.offline).toBe(2);
  });

  it('counts last24h synchronizations', async () => {
    vi.mocked(agentRepo.findAll).mockResolvedValue([]);
    await syncRepo.save(makeSync('ag', 30));    // 30 min ago — within 24h
    await syncRepo.save(makeSync('ag', 60));    // 1h ago     — within 24h
    await syncRepo.save(makeSync('ag', 25 * 60)); // 25h ago  — excluded
    const m = await service.getMetrics();
    expect(m.last24hSynchronizations).toBe(2);
  });
});

describe('DashboardMetricsService.getActivity', () => {
  let service: DashboardMetricsService;
  let agentRepo: AtlasAgentRepository;
  let heartbeatRepo: InMemoryHeartbeatRecordRepository;
  let syncRepo:      InMemorySyncRecordRepository;

  beforeEach(() => {
    agentRepo     = { findAll: vi.fn(), save: vi.fn(), update: vi.fn(), findById: vi.fn(), findByMachineId: vi.fn(), findByCompany: vi.fn(), findOnline: vi.fn(), delete: vi.fn() };
    heartbeatRepo = new InMemoryHeartbeatRecordRepository();
    syncRepo      = new InMemorySyncRecordRepository();
    service = new DashboardMetricsService(agentRepo, syncRepo, heartbeatRepo);
  });

  it('returns recent heartbeats and syncs', async () => {
    const hb = HeartbeatRecord.create({ agentId: 'ag', receivedAt: new Date(), version: '1.0', hostname: 'h', status: 'ONLINE' });
    await heartbeatRepo.save(hb);
    const activity = await service.getActivity();
    expect(activity.recentHeartbeats).toHaveLength(1);
    expect(activity.recentSyncs).toHaveLength(0);
  });
});
