import type {
  ClusterNode,
  ClusterNodeWithReplication,
  ClusterOverview,
  FailoverEvent,
  BackupRecord,
  BackupStatus,
  BackupType,
  HaEvent,
  HaEventType,
  NodeRole,
  NodeStatus,
  RecoveryTest,
  ReplicationState,
  ReplicationStatus,
  ClusterHealth,
} from './types.js';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function computeClusterHealth(nodes: ClusterNode[]): ClusterHealth {
  const leader = nodes.find((n) => n.role === 'leader');
  if (!leader || leader.status === 'offline') return 'offline';
  if (leader.status === 'failover' || leader.status === 'recovering') return 'critical';
  if (leader.status === 'degraded') return 'degraded';
  if (nodes.some((n) => n.status === 'degraded' || n.status === 'offline')) return 'degraded';
  return 'healthy';
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

function seedNodes(): ClusterNode[] {
  const d30 = ago(60 * 24 * 30);
  const d7 = ago(60 * 24 * 7);
  const d14 = ago(60 * 24 * 14);
  return [
    {
      id: 'nd-001',
      hostname: 'atlas-api-alpha.internal',
      role: 'leader',
      status: 'online',
      region: 'us-east-1',
      version: '1.0.0',
      lastHeartbeat: ago(0),
      createdAt: d30,
    },
    {
      id: 'nd-002',
      hostname: 'atlas-api-beta.internal',
      role: 'secondary',
      status: 'online',
      region: 'us-west-2',
      version: '1.0.0',
      lastHeartbeat: ago(1),
      createdAt: d30,
    },
    {
      id: 'nd-003',
      hostname: 'atlas-api-gamma.internal',
      role: 'standby',
      status: 'online',
      region: 'eu-west-1',
      version: '1.0.0',
      lastHeartbeat: ago(2),
      createdAt: d7,
    },
    {
      id: 'nd-004',
      hostname: 'atlas-api-delta.internal',
      role: 'standby',
      status: 'degraded',
      region: 'ap-southeast-1',
      version: '1.0.0',
      lastHeartbeat: ago(8),
      createdAt: d7,
    },
    {
      id: 'nd-005',
      hostname: 'atlas-worker-01.internal',
      role: 'worker',
      status: 'online',
      region: 'us-east-1',
      version: '1.0.0',
      lastHeartbeat: ago(0),
      createdAt: d14,
    },
  ];
}

function seedReplication(): ReplicationState[] {
  return [
    { nodeId: 'nd-002', status: 'in_sync', lagMs: 2, lastSynced: ago(0), divergenceBytes: 0 },
    { nodeId: 'nd-003', status: 'in_sync', lagMs: 5, lastSynced: ago(1), divergenceBytes: 0 },
    {
      nodeId: 'nd-004',
      status: 'lagging',
      lagMs: 450,
      lastSynced: ago(8),
      divergenceBytes: 131_072,
    },
  ];
}

function seedFailovers(): FailoverEvent[] {
  const d30 = Date.now() - 60 * 24 * 30 * 60_000;
  const d7 = Date.now() - 60 * 24 * 7 * 60_000;
  const d1 = Date.now() - 60 * 24 * 60_000;
  return [
    {
      id: 'fo-001',
      fromNodeId: 'nd-003',
      fromHostname: 'atlas-api-gamma.internal',
      toNodeId: 'nd-001',
      toHostname: 'atlas-api-alpha.internal',
      reason: 'Network partition — node-gamma unreachable for 60s',
      automatic: true,
      startedAt: new Date(d30).toISOString(),
      finishedAt: new Date(d30 + 12_000).toISOString(),
      durationMs: 12_000,
      rtoSeconds: 12,
      success: true,
    },
    {
      id: 'fo-002',
      fromNodeId: 'nd-004',
      fromHostname: 'atlas-api-delta.internal',
      toNodeId: 'nd-002',
      toHostname: 'atlas-api-beta.internal',
      reason: 'Disk I/O failure detected by health monitor',
      automatic: true,
      startedAt: new Date(d7).toISOString(),
      finishedAt: new Date(d7 + 8_000).toISOString(),
      durationMs: 8_000,
      rtoSeconds: 8,
      success: true,
    },
    {
      id: 'fo-003',
      fromNodeId: 'nd-001',
      fromHostname: 'atlas-api-alpha.internal',
      toNodeId: 'nd-002',
      toHostname: 'atlas-api-beta.internal',
      reason: 'Scheduled maintenance failover drill',
      automatic: false,
      startedAt: new Date(d1).toISOString(),
      finishedAt: new Date(d1 + 5_000).toISOString(),
      durationMs: 5_000,
      rtoSeconds: 5,
      success: true,
    },
  ];
}

function seedBackups(): BackupRecord[] {
  const expires30 = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
  const expires14 = new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString();
  const expires7 = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  return [
    {
      id: 'bk-001',
      tenantId: 'tenant-enterprise',
      type: 'full',
      sizeBytes: 2_400_000_000,
      sizeLabel: '2.4 GB',
      status: 'completed',
      checksum: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      createdAt: ago(2),
      expiresAt: expires30,
    },
    {
      id: 'bk-002',
      tenantId: 'tenant-professional',
      type: 'full',
      sizeBytes: 850_000_000,
      sizeLabel: '850 MB',
      status: 'completed',
      checksum: 'sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
      createdAt: ago(4),
      expiresAt: expires30,
    },
    {
      id: 'bk-003',
      tenantId: 'tenant-community',
      type: 'incremental',
      sizeBytes: 120_000_000,
      sizeLabel: '120 MB',
      status: 'completed',
      checksum: 'sha256:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      createdAt: ago(240),
      expiresAt: expires7,
    },
    {
      id: 'bk-004',
      tenantId: 'tenant-enterprise',
      type: 'incremental',
      sizeBytes: 180_000_000,
      sizeLabel: '180 MB',
      status: 'completed',
      checksum: 'sha256:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
      createdAt: ago(60 * 12),
      expiresAt: expires7,
    },
    {
      id: 'bk-005',
      tenantId: 'tenant-professional',
      type: 'snapshot',
      sizeBytes: 650_000_000,
      sizeLabel: '650 MB',
      status: 'completed',
      checksum: 'sha256:e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
      createdAt: ago(60 * 24),
      expiresAt: expires14,
    },
    {
      id: 'bk-006',
      tenantId: 'tenant-enterprise',
      type: 'full',
      sizeBytes: 2_100_000_000,
      sizeLabel: '2.1 GB',
      status: 'completed',
      checksum: 'sha256:f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
      createdAt: ago(60 * 24 * 7),
      expiresAt: expires30,
    },
  ];
}

function seedRecoveryTests(): RecoveryTest[] {
  return [
    {
      id: 'rt-001',
      tenantId: 'tenant-enterprise',
      result: 'passed',
      rtoSeconds: 12,
      rpoMinutes: 5,
      durationMs: 3_600,
      notes: 'Full restore from bk-006 — all services recovered within target',
      testedAt: ago(60 * 24 * 30),
    },
    {
      id: 'rt-002',
      tenantId: 'tenant-professional',
      result: 'passed',
      rtoSeconds: 45,
      rpoMinutes: 15,
      durationMs: 8_400,
      notes: 'Partial restore — connectors took 38s to reconnect',
      testedAt: ago(60 * 24 * 14),
    },
    {
      id: 'rt-003',
      tenantId: 'tenant-community',
      result: 'failed',
      rtoSeconds: 0,
      rpoMinutes: 0,
      durationMs: 15_000,
      notes: 'Restore timed out — backup integrity check failed for bk-003',
      testedAt: ago(60 * 24 * 7),
    },
    {
      id: 'rt-004',
      tenantId: 'tenant-enterprise',
      result: 'passed',
      rtoSeconds: 10,
      rpoMinutes: 4,
      durationMs: 3_200,
      notes: 'Improved RTO by 2s vs previous test — optimized agent startup sequence',
      testedAt: ago(60 * 24),
    },
  ];
}

function seedHaEvents(): HaEvent[] {
  const ev = (
    id: string,
    type: HaEventType,
    severity: HaEvent['severity'],
    message: string,
    payload: Record<string, unknown>,
    createdAt: string
  ): HaEvent => ({ id, type, severity, message, payload, createdAt });
  return [
    ev(
      'ev-ha-001',
      'node.joined',
      'info',
      'Node atlas-api-alpha.internal joined cluster as leader',
      { nodeId: 'nd-001' },
      ago(60 * 24 * 30)
    ),
    ev(
      'ev-ha-002',
      'node.joined',
      'info',
      'Node atlas-api-beta.internal joined cluster as secondary',
      { nodeId: 'nd-002' },
      ago(60 * 24 * 30 - 5)
    ),
    ev(
      'ev-ha-003',
      'failover.initiated',
      'warning',
      'Automatic failover triggered — node-gamma unreachable',
      { fromNode: 'nd-003', toNode: 'nd-001' },
      ago(60 * 24 * 30)
    ),
    ev(
      'ev-ha-004',
      'failover.completed',
      'info',
      'Failover completed in 12s — atlas-api-alpha.internal promoted to leader',
      { rtoSeconds: 12, failoverId: 'fo-001' },
      ago(60 * 24 * 30 - 1)
    ),
    ev(
      'ev-ha-005',
      'replication.lagging',
      'warning',
      'Replication lag on nd-004 exceeded threshold (450ms)',
      { nodeId: 'nd-004', lagMs: 450 },
      ago(10)
    ),
    ev(
      'ev-ha-006',
      'node.degraded',
      'warning',
      'Node atlas-api-delta.internal degraded — replication lag >300ms',
      { nodeId: 'nd-004', lagMs: 450 },
      ago(8)
    ),
    ev(
      'ev-ha-007',
      'backup.completed',
      'info',
      'Full backup completed for tenant-enterprise (2.4 GB)',
      { backupId: 'bk-001', tenantId: 'tenant-enterprise' },
      ago(2)
    ),
    ev(
      'ev-ha-008',
      'backup.completed',
      'info',
      'Full backup completed for tenant-professional (850 MB)',
      { backupId: 'bk-002', tenantId: 'tenant-professional' },
      ago(4)
    ),
    ev(
      'ev-ha-009',
      'backup.completed',
      'info',
      'Incremental backup completed for tenant-enterprise (180 MB)',
      { backupId: 'bk-004', tenantId: 'tenant-enterprise' },
      ago(60 * 12)
    ),
    ev(
      'ev-ha-010',
      'recovery.test.passed',
      'info',
      'Recovery test passed for tenant-enterprise — RTO: 10s, RPO: 4min',
      { rtoSeconds: 10, rpoMinutes: 4 },
      ago(60 * 24)
    ),
    ev(
      'ev-ha-011',
      'recovery.test.failed',
      'error',
      'Recovery test failed for tenant-community — backup integrity check failed',
      { tenantId: 'tenant-community' },
      ago(60 * 24 * 7)
    ),
    ev(
      'ev-ha-012',
      'replication.normalized',
      'info',
      'Replication lag on nd-003 normalized (5ms)',
      { nodeId: 'nd-003', lagMs: 5 },
      ago(60 * 6)
    ),
  ];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class HaStore {
  private nodes: ClusterNode[] = seedNodes();
  private replication: ReplicationState[] = seedReplication();
  private failovers: FailoverEvent[] = seedFailovers();
  private backups: BackupRecord[] = seedBackups();
  private recoveryTests: RecoveryTest[] = seedRecoveryTests();
  private haEvents: HaEvent[] = seedHaEvents();

  // ── Nodes ──────────────────────────────────────────────────────────────────

  getNodes(filters?: { status?: NodeStatus; role?: NodeRole }): ClusterNode[] {
    let list = [...this.nodes];
    if (filters?.status) list = list.filter((n) => n.status === filters.status);
    if (filters?.role) list = list.filter((n) => n.role === filters.role);
    return list;
  }

  getNodesWithReplication(filters?: {
    status?: NodeStatus;
    role?: NodeRole;
  }): ClusterNodeWithReplication[] {
    return this.getNodes(filters).map((n) => ({
      ...n,
      replication: this.replication.find((r) => r.nodeId === n.id),
    }));
  }

  getNode(id: string): ClusterNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  updateNode(id: string, updates: Partial<ClusterNode>): ClusterNode | null {
    const idx = this.nodes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    this.nodes[idx] = { ...this.nodes[idx]!, ...updates };
    return this.nodes[idx]!;
  }

  addNode(data: Omit<ClusterNode, 'id' | 'createdAt'>): ClusterNode {
    const node: ClusterNode = { id: genId('nd'), ...data, createdAt: nowIso() };
    this.nodes.push(node);
    return node;
  }

  promoteNodeToLeader(id: string): ClusterNode | null {
    // Demote current leader first
    const currentLeader = this.nodes.find((n) => n.role === 'leader');
    if (currentLeader) {
      this.updateNode(currentLeader.id, { role: 'secondary' });
    }
    return this.updateNode(id, { role: 'leader', status: 'online' });
  }

  // ── Replication ────────────────────────────────────────────────────────────

  getReplicationStates(): ReplicationState[] {
    return [...this.replication];
  }

  getReplicationState(nodeId: string): ReplicationState | undefined {
    return this.replication.find((r) => r.nodeId === nodeId);
  }

  upsertReplicationState(state: ReplicationState): void {
    const idx = this.replication.findIndex((r) => r.nodeId === state.nodeId);
    if (idx !== -1) this.replication[idx] = state;
    else this.replication.push(state);
  }

  // ── Failover events ────────────────────────────────────────────────────────

  getFailoverEvents(limit = 50): FailoverEvent[] {
    return [...this.failovers]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  addFailoverEvent(data: Omit<FailoverEvent, 'id'>): FailoverEvent {
    const event: FailoverEvent = { id: genId('fo'), ...data };
    this.failovers.unshift(event);
    return event;
  }

  // ── Backups ────────────────────────────────────────────────────────────────

  getBackups(tenantId?: string, status?: BackupStatus): BackupRecord[] {
    let list = [...this.backups];
    if (tenantId) list = list.filter((b) => b.tenantId === tenantId);
    if (status) list = list.filter((b) => b.status === status);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getBackup(id: string): BackupRecord | undefined {
    return this.backups.find((b) => b.id === id);
  }

  createBackup(data: Omit<BackupRecord, 'id'>): BackupRecord {
    const record: BackupRecord = { id: genId('bk'), ...data };
    this.backups.unshift(record);
    return record;
  }

  // ── Recovery tests ─────────────────────────────────────────────────────────

  getRecoveryTests(tenantId?: string): RecoveryTest[] {
    const list = tenantId
      ? this.recoveryTests.filter((t) => t.tenantId === tenantId)
      : [...this.recoveryTests];
    return list.sort((a, b) => b.testedAt.localeCompare(a.testedAt));
  }

  addRecoveryTest(data: Omit<RecoveryTest, 'id'>): RecoveryTest {
    const test: RecoveryTest = { id: genId('rt'), ...data };
    this.recoveryTests.unshift(test);
    return test;
  }

  // ── HA Events ──────────────────────────────────────────────────────────────

  getHaEvents(limit = 50): HaEvent[] {
    return [...this.haEvents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  addHaEvent(data: Omit<HaEvent, 'id' | 'createdAt'>): HaEvent {
    const event: HaEvent = { id: genId('ev'), ...data, createdAt: nowIso() };
    this.haEvents.unshift(event);
    return event;
  }

  // ── Cluster overview ───────────────────────────────────────────────────────

  getClusterOverview(): ClusterOverview {
    const nodes = this.getNodesWithReplication();
    const onlineNodes = nodes.filter((n) => n.status === 'online').length;
    const degradedNodes = nodes.filter((n) => n.status === 'degraded').length;
    const offlineNodes = nodes.filter((n) => n.status === 'offline').length;
    const leaderNode = nodes.find((n) => n.role === 'leader') ?? null;
    const clusterHealth = computeClusterHealth(this.nodes);

    const replicas = this.replication;
    const inSync = replicas.filter((r) => r.status === 'in_sync').length;
    const lagging = replicas.filter(
      (r) => r.status === 'lagging' || r.status === 'diverged'
    ).length;
    const stopped = replicas.filter((r) => r.status === 'stopped').length;
    const avgLagMs = replicas.length
      ? Math.round(replicas.reduce((s, r) => s + r.lagMs, 0) / replicas.length)
      : 0;

    const lastBackup = this.getBackups(undefined, 'completed')[0] ?? null;
    const lastFailover = this.getFailoverEvents(1)[0] ?? null;

    const passed = this.recoveryTests.filter((t) => t.result === 'passed');
    const avgRtoSeconds = passed.length
      ? Math.round(passed.reduce((s, t) => s + t.rtoSeconds, 0) / passed.length)
      : 0;
    const avgRpoMinutes = passed.length
      ? Math.round(passed.reduce((s, t) => s + t.rpoMinutes, 0) / passed.length)
      : 0;

    return {
      totalNodes: nodes.length,
      onlineNodes,
      degradedNodes,
      offlineNodes,
      clusterHealth,
      leaderNode,
      replication: { totalReplicas: replicas.length, inSync, lagging, stopped, avgLagMs },
      lastBackup,
      lastFailover,
      avgRtoSeconds,
      avgRpoMinutes,
    };
  }
}

export const haStore = new HaStore();
