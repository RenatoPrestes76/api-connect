import type { RuntimeLiveness } from './liveness.js';

// ─── Runtime status ─────────────────────────────────────────────────────────
// PENDING is reserved for a future manual-approval/two-phase registration
// flow — no transition in this sprint produces it. register() creates a
// runtime directly as REGISTERED; the first heartbeat promotes it to ACTIVE.

export type RuntimeStatus = 'PENDING' | 'REGISTERED' | 'ACTIVE' | 'BLOCKED' | 'REVOKED';

// ─── Runtime registration ───────────────────────────────────────────────────

export interface RuntimeRegistrationRecord {
  id: string;
  organizationId: string;
  /**
   * ATLAS 46.21 — cross-reference to the real, Postgres-persisted Control
   * Plane Organization (see portal-identity's OrganizationRecord.
   * controlPlaneOrganizationId, resolved at registration time from
   * `organizationId` above). Null when the owning portal Organization
   * never got linked (e.g. it was created before this field existed, or
   * the Control Plane database was unreachable at portal-registration
   * time) — see docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md.
   */
  controlPlaneOrganizationId: string | null;
  machineFingerprintHash: string;
  hostname: string;
  os: string;
  architecture: string;
  version: string;
  status: RuntimeStatus;
  publicKey: string;
  /**
   * Declarative capabilities the Runtime reports it supports (e.g.
   * "DATABASE_ACCESS", "POSTGRES", "HTTP"). Informational only — declaring a
   * capability never grants access by itself; it just tells Atlas what kinds
   * of discovery/connection requests this installation could in principle
   * handle. Updated on every heartbeat that includes it.
   */
  capabilities: string[];
  lastHeartbeat: string | null;
  /** Signature of the most recently accepted heartbeat — rejects verbatim replays within the timestamp tolerance window. Not exposed via any DTO. */
  lastHeartbeatSignature: string | null;
  lastMemoryMb: number | null;
  lastCpuPercent: number | null;
  lastUptimeSeconds: number | null;
  registeredAt: string;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeRegistrationDTO {
  runtimeId: string;
  organizationId: string;
  controlPlaneOrganizationId: string | null;
  hostname: string;
  os: string;
  architecture: string;
  version: string;
  status: RuntimeStatus;
  capabilities: string[];
  lastHeartbeat: string | null;
  lastMemoryMb: number | null;
  lastCpuPercent: number | null;
  lastUptimeSeconds: number | null;
  registeredAt: string;
  activatedAt: string | null;
  /** True when `version` is below the recommended (not minimum-required) Runtime version. */
  needsUpdate: boolean;
  /**
   * ATLAS 46.23 — operational liveness (ONLINE/STALE/OFFLINE), computed
   * fresh on every read from `lastHeartbeat` — see liveness.ts. Additive,
   * backward-compatible field: orthogonal to `status`, which keeps its
   * pre-46.23 meaning unchanged.
   */
  liveness: RuntimeLiveness;
}

// ─── Certificates ───────────────────────────────────────────────────────────

export interface RuntimeCertificateRecord {
  id: string;
  runtimeId: string;
  publicKey: string;
  certificateId: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  revokedAt: string | null;
}

// ─── Runtime sessions (JWT auth — refresh tokens) ──────────────────────────
// A second, parallel auth mode alongside the Ed25519 per-request signing
// above: a Runtime exchanges a signed proof-of-identity for a short-lived
// access token + rotating refresh token, mirroring admin-identity's session
// model. Existing signature-verified endpoints (heartbeat, job/message
// polling) are untouched — this is additive, for self-service endpoints
// that don't want to sign every request individually.

export interface RuntimeSessionRecord {
  id: string;
  runtimeId: string;
  refreshTokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

// ─── Runtime configuration (persisted, updatable) ──────────────────────────

export type RuntimeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RuntimeRetryPolicyConfig {
  maxAttempts: number;
  backoffMs: number;
}

export interface RuntimeConfigRecord {
  runtimeId: string;
  pollingIntervalMs: number;
  heartbeatIntervalMs: number;
  logLevel: RuntimeLogLevel;
  compressionEnabled: boolean;
  retryPolicy: RuntimeRetryPolicyConfig;
  connectionTimeoutMs: number;
  databaseTimeoutMs: number;
  updatedAt: string;
}

export interface RuntimeConfigPatch {
  pollingIntervalMs?: number;
  heartbeatIntervalMs?: number;
  logLevel?: RuntimeLogLevel;
  compressionEnabled?: boolean;
  retryPolicy?: Partial<RuntimeRetryPolicyConfig>;
  connectionTimeoutMs?: number;
  databaseTimeoutMs?: number;
}

// ─── Activation keys (single-use) ───────────────────────────────────────────

export interface ActivationKeyRecord {
  id: string;
  code: string;
  organizationId: string;
  organizationCode: string;
  used: boolean;
  usedAt: string | null;
  usedByRuntimeId: string | null;
  /** Set by an admin to invalidate a not-yet-consumed key (e.g. it leaked). A revoked key can never be consumed, even if unexpired. */
  revoked: boolean;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

// ─── Request / response DTOs ────────────────────────────────────────────────

export interface RegisterRuntimeInput {
  organizationCode: string;
  activationKey: string;
  runtimeVersion: string;
  fingerprint: string;
  publicKey: string;
  hostname: string;
  os: string;
  architecture?: string;
  /** Declarative only — see RuntimeRegistrationRecord.capabilities. */
  capabilities?: string[];
}

export interface RuntimeConfigDTO {
  runtimeId: string;
  certificate: string;
  organizationId: string;
  pollingInterval: number;
  heartbeatInterval: number;
  logLevel: RuntimeLogLevel;
  compressionEnabled: boolean;
  retryPolicy: RuntimeRetryPolicyConfig;
  connectionTimeoutMs: number;
  databaseTimeoutMs: number;
  connectorsEnabled: string[];
  environments: Array<{ id: string; name: string; kind: string }>;
  policies: {
    minRuntimeVersion: string;
    maxHeartbeatGapMs: number;
  };
  limits: {
    maxSyncBatchSize: number;
    maxConcurrentSyncs: number;
  };
}

export interface HeartbeatInput {
  runtimeId: string;
  version: string;
  memory: number;
  cpu: number;
  uptimeSeconds?: number;
  status?: string;
  /** Declarative only — see RuntimeRegistrationRecord.capabilities. Omitted means "unchanged". */
  capabilities?: string[];
  timestamp: string;
  signature: string;
}
