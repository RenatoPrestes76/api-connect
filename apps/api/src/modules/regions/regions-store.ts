import type {
  Region,
  RegionStatus,
  TenantRegion,
  ReplicationRecord,
  ReplicationStatus,
  CompliancePolicy,
  GlobalEvent,
  GlobalEventType,
  GlobalHealth,
  GlobalOverview,
  RegionStatusSummary,
  ReplicationSummary,
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

function computeGlobalHealth(regions: Region[]): GlobalHealth {
  const hasOffline = regions.some((r) => r.status === 'offline');
  if (hasOffline) return 'critical';
  const hasDegraded = regions.some((r) => r.status === 'degraded' || r.status === 'maintenance');
  if (hasDegraded) return 'degraded';
  return 'healthy';
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

function seedRegions(): Region[] {
  const d = ago(60 * 24 * 60); // 60 days ago
  return [
    {
      id: 'rg-001',
      name: 'Brazil South',
      code: 'br-south-1',
      status: 'active',
      location: 'São Paulo, Brazil',
      continent: 'Americas',
      flag: '🇧🇷',
      provider: 'aws',
      latencyMs: 45,
      capacityPct: 62,
      tenantsCount: 1,
      createdAt: d,
    },
    {
      id: 'rg-002',
      name: 'US East',
      code: 'us-east-1',
      status: 'active',
      location: 'Virginia, USA',
      continent: 'Americas',
      flag: '🇺🇸',
      provider: 'aws',
      latencyMs: 12,
      capacityPct: 78,
      tenantsCount: 1,
      createdAt: d,
    },
    {
      id: 'rg-003',
      name: 'Europe West',
      code: 'eu-west-1',
      status: 'active',
      location: 'Dublin, Ireland',
      continent: 'Europe',
      flag: '🇮🇪',
      provider: 'aws',
      latencyMs: 28,
      capacityPct: 55,
      tenantsCount: 1,
      createdAt: d,
    },
    {
      id: 'rg-004',
      name: 'US West',
      code: 'us-west-2',
      status: 'degraded',
      location: 'Oregon, USA',
      continent: 'Americas',
      flag: '🇺🇸',
      provider: 'aws',
      latencyMs: 18,
      capacityPct: 88,
      tenantsCount: 0,
      createdAt: d,
    },
    {
      id: 'rg-005',
      name: 'Asia Pacific',
      code: 'ap-southeast-1',
      status: 'active',
      location: 'Singapore',
      continent: 'Asia-Pacific',
      flag: '🇸🇬',
      provider: 'aws',
      latencyMs: 65,
      capacityPct: 40,
      tenantsCount: 0,
      createdAt: d,
    },
  ];
}

function seedTenantRegions(): TenantRegion[] {
  return [
    {
      tenantId: 'tenant-enterprise',
      primaryRegion: 'us-east-1',
      secondaryRegion: 'eu-west-1',
      drRegion: 'br-south-1',
      complianceRegion: 'eu-west-1',
      placement: 'optimal',
    },
    {
      tenantId: 'tenant-professional',
      primaryRegion: 'br-south-1',
      secondaryRegion: 'us-east-1',
      drRegion: 'us-west-2',
      complianceRegion: 'br-south-1',
      placement: 'pinned',
    },
    {
      tenantId: 'tenant-community',
      primaryRegion: 'eu-west-1',
      secondaryRegion: 'br-south-1',
      drRegion: 'us-east-1',
      complianceRegion: 'eu-west-1',
      placement: 'optimal',
    },
  ];
}

function seedReplication(): ReplicationRecord[] {
  const now = nowIso();
  const r = (
    id: string,
    src: string,
    tgt: string,
    status: ReplicationStatus,
    latencyMs: number,
    items: number,
    pending = 0
  ): ReplicationRecord => ({
    id,
    sourceRegion: src,
    targetRegion: tgt,
    status,
    latencyMs,
    lastSynced: status === 'failed' ? ago(120) : ago(Math.floor(latencyMs / 10)),
    itemsReplicated: items,
    pendingItems: pending,
    updatedAt: now,
  });
  return [
    r('rep-001', 'us-east-1', 'eu-west-1', 'in_sync', 18, 892),
    r('rep-002', 'us-east-1', 'br-south-1', 'in_sync', 125, 891),
    r('rep-003', 'eu-west-1', 'br-south-1', 'in_sync', 130, 888),
    r('rep-004', 'eu-west-1', 'us-east-1', 'in_sync', 22, 891),
    r('rep-005', 'br-south-1', 'us-east-1', 'lagging', 145, 885, 6),
    r('rep-006', 'br-south-1', 'eu-west-1', 'in_sync', 132, 888),
    r('rep-007', 'us-west-2', 'us-east-1', 'failed', 0, 741),
    r('rep-008', 'ap-southeast-1', 'us-east-1', 'in_sync', 210, 880),
  ];
}

function seedCompliance(): CompliancePolicy[] {
  const now = nowIso();
  const p = (
    id: string,
    tenantId: string,
    policy: CompliancePolicy['policy'],
    enabled: boolean,
    region?: string,
    details: Record<string, unknown> = {}
  ): CompliancePolicy => ({ id, tenantId, policy, enabled, region, details, createdAt: now });
  return [
    // Enterprise
    p('cp-001', 'tenant-enterprise', 'gdpr', true, 'eu-west-1', {
      strictMode: true,
      dpo: 'dpo@omegacorp.eu',
    }),
    p('cp-002', 'tenant-enterprise', 'data_residency', true, 'eu-west-1', {
      allowedRegions: ['eu-west-1'],
      strictTransfer: true,
    }),
    p('cp-003', 'tenant-enterprise', 'data_retention', true, undefined, {
      retentionYears: 2,
      autoDelete: true,
    }),
    p('cp-004', 'tenant-enterprise', 'secure_deletion', true, undefined, {
      algorithm: 'DoD 5220.22-M',
      passes: 7,
    }),
    // Professional
    p('cp-005', 'tenant-professional', 'lgpd', true, 'br-south-1', {
      controller: 'legal@betasystems.com.br',
    }),
    p('cp-006', 'tenant-professional', 'data_residency', true, 'br-south-1', {
      allowedRegions: ['br-south-1', 'us-east-1'],
    }),
    p('cp-007', 'tenant-professional', 'data_retention', true, undefined, {
      retentionYears: 1,
      autoDelete: false,
    }),
    // Community
    p('cp-008', 'tenant-community', 'lgpd', false, 'eu-west-1', { pending: true }),
    p('cp-009', 'tenant-community', 'gdpr', true, 'eu-west-1', { strictMode: false }),
  ];
}

function seedGlobalEvents(): GlobalEvent[] {
  const ev = (
    id: string,
    type: GlobalEventType,
    severity: GlobalEvent['severity'],
    message: string,
    payload: Record<string, unknown>,
    createdAt: string,
    region?: string,
    tenantId?: string
  ): GlobalEvent => ({ id, type, severity, message, payload, createdAt, region, tenantId });
  return [
    ev(
      'ge-001',
      'region.connected',
      'info',
      'Region br-south-1 connected to Global Control Plane',
      { region: 'br-south-1' },
      ago(60 * 24 * 60),
      'br-south-1'
    ),
    ev(
      'ge-002',
      'region.connected',
      'info',
      'Region us-east-1 connected to Global Control Plane',
      { region: 'us-east-1' },
      ago(60 * 24 * 60 - 2),
      'us-east-1'
    ),
    ev(
      'ge-003',
      'replication.started',
      'info',
      'Replication started: us-east-1 → eu-west-1',
      { source: 'us-east-1', target: 'eu-west-1' },
      ago(60 * 24 * 30),
      'us-east-1'
    ),
    ev(
      'ge-004',
      'replication.completed',
      'info',
      'Replication completed: us-east-1 → eu-west-1 (892 items, 18ms)',
      { items: 892, latencyMs: 18 },
      ago(60 * 24 * 30 - 5),
      'us-east-1'
    ),
    ev(
      'ge-005',
      'tenant.migrated',
      'info',
      'Tenant tenant-enterprise migrated primary to us-east-1',
      { tenantId: 'tenant-enterprise', region: 'us-east-1' },
      ago(60 * 24 * 14),
      'us-east-1',
      'tenant-enterprise'
    ),
    ev(
      'ge-006',
      'region.degraded',
      'warning',
      'Region us-west-2 degraded — high capacity utilization (88%)',
      { region: 'us-west-2', capacityPct: 88 },
      ago(60 * 24 * 3),
      'us-west-2'
    ),
    ev(
      'ge-007',
      'replication.lagging',
      'warning',
      'Replication lagging: br-south-1 → us-east-1 (6 pending items)',
      { pending: 6, latencyMs: 145 },
      ago(60 * 2),
      'br-south-1'
    ),
    ev(
      'ge-008',
      'region.failover.initiated',
      'warning',
      'Regional failover initiated: us-west-2 → us-east-1',
      { fromRegion: 'us-west-2', toRegion: 'us-east-1' },
      ago(60 * 24 * 3 - 5),
      'us-west-2'
    ),
    ev(
      'ge-009',
      'region.failover.completed',
      'info',
      'Regional failover completed in 8s — us-east-1 now serving us-west-2',
      { rtoSeconds: 8 },
      ago(60 * 24 * 3 - 4),
      'us-east-1'
    ),
    ev(
      'ge-010',
      'compliance.validated',
      'info',
      'GDPR compliance validated for tenant-enterprise (eu-west-1)',
      { tenantId: 'tenant-enterprise', policy: 'gdpr' },
      ago(60 * 24),
      'eu-west-1',
      'tenant-enterprise'
    ),
  ];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class RegionsStore {
  private regions: Region[] = seedRegions();
  private tenantRegions: TenantRegion[] = seedTenantRegions();
  private replication: ReplicationRecord[] = seedReplication();
  private compliance: CompliancePolicy[] = seedCompliance();
  private events: GlobalEvent[] = seedGlobalEvents();

  // ── Regions ────────────────────────────────────────────────────────────────

  getRegions(filters?: { status?: RegionStatus; continent?: string }): Region[] {
    let list = [...this.regions];
    if (filters?.status) list = list.filter((r) => r.status === filters.status);
    if (filters?.continent) list = list.filter((r) => r.continent === filters.continent);
    return list.sort((a, b) => a.latencyMs - b.latencyMs);
  }

  getRegion(id: string): Region | undefined {
    return this.regions.find((r) => r.id === id);
  }

  getRegionByCode(code: string): Region | undefined {
    return this.regions.find((r) => r.code === code);
  }

  updateRegionStatus(code: string, status: RegionStatus): Region | null {
    const region = this.regions.find((r) => r.code === code);
    if (!region) return null;
    region.status = status;
    return { ...region };
  }

  getStatusSummary(): RegionStatusSummary {
    const list = this.regions;
    return {
      total: list.length,
      active: list.filter((r) => r.status === 'active').length,
      degraded: list.filter((r) => r.status === 'degraded').length,
      offline: list.filter((r) => r.status === 'offline').length,
      maintenance: list.filter((r) => r.status === 'maintenance').length,
      globalHealth: computeGlobalHealth(list),
    };
  }

  // ── Tenant regions ─────────────────────────────────────────────────────────

  getTenantPlacements(): TenantRegion[] {
    return [...this.tenantRegions];
  }

  getTenantPlacement(tenantId: string): TenantRegion | undefined {
    return this.tenantRegions.find((t) => t.tenantId === tenantId);
  }

  updateTenantPlacement(tenantId: string, updates: Partial<TenantRegion>): TenantRegion | null {
    const idx = this.tenantRegions.findIndex((t) => t.tenantId === tenantId);
    if (idx === -1) return null;
    this.tenantRegions[idx] = { ...this.tenantRegions[idx]!, ...updates };
    return { ...this.tenantRegions[idx]! };
  }

  getTenantsPerRegion(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const t of this.tenantRegions) {
      counts[t.primaryRegion] = (counts[t.primaryRegion] ?? 0) + 1;
    }
    return counts;
  }

  // ── Replication ────────────────────────────────────────────────────────────

  getReplicationRecords(
    sourceRegion?: string,
    targetRegion?: string,
    status?: ReplicationStatus
  ): ReplicationRecord[] {
    let list = [...this.replication];
    if (sourceRegion) list = list.filter((r) => r.sourceRegion === sourceRegion);
    if (targetRegion) list = list.filter((r) => r.targetRegion === targetRegion);
    if (status) list = list.filter((r) => r.status === status);
    return list;
  }

  upsertReplication(data: Omit<ReplicationRecord, 'id' | 'updatedAt'>): ReplicationRecord {
    const existing = this.replication.find(
      (r) => r.sourceRegion === data.sourceRegion && r.targetRegion === data.targetRegion
    );
    const record: ReplicationRecord = {
      id: existing?.id ?? genId('rep'),
      ...data,
      updatedAt: nowIso(),
    };
    if (existing) {
      const idx = this.replication.indexOf(existing);
      this.replication[idx] = record;
    } else {
      this.replication.push(record);
    }
    return record;
  }

  getReplicationSummary(): ReplicationSummary {
    const list = this.replication;
    const inSync = list.filter((r) => r.status === 'in_sync').length;
    const lagging = list.filter((r) => r.status === 'lagging').length;
    const failed = list.filter((r) => r.status === 'failed').length;
    const paused = list.filter((r) => r.status === 'paused').length;
    const active = list.filter((r) => r.latencyMs > 0);
    const avgLagMs = active.length
      ? Math.round(active.reduce((s, r) => s + r.latencyMs, 0) / active.length)
      : 0;
    return { total: list.length, inSync, lagging, failed, paused, avgLatencyMs: avgLagMs };
  }

  // ── Compliance ─────────────────────────────────────────────────────────────

  getCompliancePolicies(tenantId?: string): CompliancePolicy[] {
    return tenantId ? this.compliance.filter((p) => p.tenantId === tenantId) : [...this.compliance];
  }

  // ── Global events ──────────────────────────────────────────────────────────

  getGlobalEvents(limit = 50): GlobalEvent[] {
    return [...this.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  addGlobalEvent(data: Omit<GlobalEvent, 'id' | 'createdAt'>): GlobalEvent {
    const event: GlobalEvent = { id: genId('ge'), ...data, createdAt: nowIso() };
    this.events.unshift(event);
    return event;
  }

  // ── Global overview ────────────────────────────────────────────────────────

  getGlobalOverview(): GlobalOverview {
    const regions = this.regions;
    const active = regions.filter((r) => r.status === 'active').length;
    const degraded = regions.filter((r) => r.status === 'degraded').length;
    const offline = regions.filter((r) => r.status === 'offline').length;
    const avgLatency = Math.round(regions.reduce((s, r) => s + r.latencyMs, 0) / regions.length);
    const globalHealth = computeGlobalHealth(regions);
    const replication = this.getReplicationSummary();
    const tenantsByRegion = this.getTenantsPerRegion();
    const lastEvent = this.getGlobalEvents(1)[0] ?? null;

    return {
      totalRegions: regions.length,
      activeRegions: active,
      degradedRegions: degraded,
      offlineRegions: offline,
      totalTenants: this.tenantRegions.length,
      avgLatencyMs: avgLatency,
      globalHealth,
      replication,
      tenantsByRegion,
      regions,
      lastEvent,
    };
  }
}

export const regionsStore = new RegionsStore();
