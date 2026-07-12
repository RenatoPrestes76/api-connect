export type RegionStatus = 'active' | 'degraded' | 'offline' | 'maintenance';
export type ReplicationStatus = 'in_sync' | 'lagging' | 'failed' | 'paused';
export type TenantPlacement = 'optimal' | 'pinned' | 'migrating';
export type CompliancePolicyType =
  | 'lgpd'
  | 'gdpr'
  | 'data_residency'
  | 'data_retention'
  | 'secure_deletion';
export type GlobalHealth = 'healthy' | 'degraded' | 'critical' | 'offline';
export type GlobalEventType =
  | 'region.connected'
  | 'region.disconnected'
  | 'region.degraded'
  | 'region.recovered'
  | 'replication.started'
  | 'replication.completed'
  | 'replication.failed'
  | 'replication.lagging'
  | 'tenant.migrated'
  | 'region.failover.initiated'
  | 'region.failover.completed'
  | 'sync.completed'
  | 'compliance.validated'
  | 'compliance.violation';

export interface Region {
  id: string;
  name: string;
  code: string;
  status: RegionStatus;
  location: string;
  continent: string;
  flag: string;
  provider: string;
  latencyMs: number;
  capacityPct: number;
  tenantsCount: number;
  createdAt: string;
}

export interface TenantRegion {
  tenantId: string;
  primaryRegion: string;
  secondaryRegion: string;
  drRegion: string;
  complianceRegion: string;
  placement: TenantPlacement;
}

export interface ReplicationRecord {
  id: string;
  sourceRegion: string;
  targetRegion: string;
  status: ReplicationStatus;
  latencyMs: number;
  lastSynced: string;
  itemsReplicated: number;
  pendingItems: number;
  updatedAt: string;
}

export interface CompliancePolicy {
  id: string;
  tenantId: string;
  policy: CompliancePolicyType;
  enabled: boolean;
  region?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface GlobalEvent {
  id: string;
  type: GlobalEventType;
  region?: string;
  tenantId?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ReplicationSummary {
  total: number;
  inSync: number;
  lagging: number;
  failed: number;
  paused: number;
  avgLatencyMs: number;
}

export interface GlobalOverview {
  totalRegions: number;
  activeRegions: number;
  degradedRegions: number;
  offlineRegions: number;
  totalTenants: number;
  avgLatencyMs: number;
  globalHealth: GlobalHealth;
  replication: ReplicationSummary;
  tenantsByRegion: Record<string, number>;
  regions: Region[];
  lastEvent: GlobalEvent | null;
}

export interface RegionStatusSummary {
  total: number;
  active: number;
  degraded: number;
  offline: number;
  maintenance: number;
  globalHealth: GlobalHealth;
}

export interface SyncResult {
  success: boolean;
  sourceRegion: string;
  targetRegion: string;
  scope: string;
  itemsSynced: number;
  latencyMs: number;
  syncedAt: string;
  message: string;
}

export interface FailoverResult {
  success: boolean;
  tenantId: string;
  fromRegion: string;
  toRegion: string;
  reason: string;
  failoveredAt: string;
  complianceChecked: boolean;
  message: string;
}

export interface MigrationResult {
  success: boolean;
  tenantId: string;
  previousRegion: string;
  targetRegion: string;
  reason: string;
  migratedAt: string;
  complianceWarnings: string[];
  message: string;
}

export interface ComplianceCheckResult {
  compliant: boolean;
  warnings: string[];
  blockers: string[];
}
