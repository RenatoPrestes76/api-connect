// ─── Runtime registration (Sprint 46.3/46.7) — the on-premise ERP-connector
// agent installed at a customer site. Distinct from the fleet "Runtime" in
// control-plane.ts, which represents HA/load-balancer cluster nodes.

export type AtlasRuntimeStatus = 'PENDING' | 'REGISTERED' | 'ACTIVE' | 'BLOCKED' | 'REVOKED';

export interface AtlasRuntime {
  runtimeId: string;
  organizationId: string;
  hostname: string;
  os: string;
  architecture: string;
  version: string;
  status: AtlasRuntimeStatus;
  capabilities: string[];
  lastHeartbeat: string | null;
  lastMemoryMb: number | null;
  lastCpuPercent: number | null;
  lastUptimeSeconds: number | null;
  registeredAt: string;
  activatedAt: string | null;
  needsUpdate: boolean;
}

export interface ActivationKey {
  id: string;
  code: string;
  organizationId: string;
  organizationCode: string;
  used: boolean;
  usedAt: string | null;
  usedByRuntimeId: string | null;
  revoked: boolean;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

// ─── ERP metadata discovery (Sprint 46.9) ──────────────────────────────────

export type DiscoveryStatus =
  | 'REQUESTED'
  | 'REJECTED'
  | 'CLAIMED'
  | 'SCANNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT';

export interface DiscoveryRequest {
  id: string;
  runtimeId: string;
  organizationId: string;
  profileId: string;
  createdBy: string;
  status: DiscoveryStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  scheduledAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
}

export interface ErpMetadataTableSummary {
  table: string;
  entity: string;
}

export interface ErpMetadataCache {
  profileId: string;
  checksum: string;
  version: number;
  lastDiscoveredAt: string;
  lastRequestId: string;
}

// ─── Semantic mapping (Sprint 46.10) ───────────────────────────────────────

export type MappingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MappingReason {
  signal: string;
  weight: number;
  detail: string;
}

export interface MappingConflict {
  entityA: string;
  entityB: string;
  detail: string;
}

export interface MappingHistoryEntry {
  action: string;
  entity: string;
  confidence: number | null;
  modelVersion: number;
  actorEmail: string | null;
  createdAt: string;
}

export interface SemanticMapping {
  profileId: string;
  schema: string;
  table: string;
  status: MappingStatus;
  athenaEntity: string;
  suggestedEntity: string;
  suggestedConfidence: number;
  reasons: MappingReason[];
  alternatives: Array<{ entity: string; confidence: number }>;
  conflicts: MappingConflict[];
  reasoning: string;
  approvedEntity: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  modelVersion: number;
  createdAt: string;
  updatedAt: string;
  history: MappingHistoryEntry[];
}

// ─── Canonical model (Sprint 46.11) ────────────────────────────────────────

export interface CanonicalEntity {
  id: string;
  cblTerm: string;
  entityKind: string;
  domain: string;
  sourceName: string;
  confidence: number;
  mappingStatus: string;
}

export interface CanonicalModel {
  id: string;
  name: string;
  version: string;
  domain: string;
  statistics: {
    totalEntities: number;
    mappedEntities: number;
    unmappedEntities: number;
    totalFields: number;
    mappedFields: number;
    averageConfidence: number;
  };
  confidence: number;
  entities: CanonicalEntity[];
  createdAt: string;
  updatedAt: string;
}
