// ─── Runtime status ─────────────────────────────────────────────────────────
// PENDING is reserved for a future manual-approval/two-phase registration
// flow — no transition in this sprint produces it. register() creates a
// runtime directly as REGISTERED; the first heartbeat promotes it to ACTIVE.

export type RuntimeStatus = 'PENDING' | 'REGISTERED' | 'ACTIVE' | 'BLOCKED' | 'REVOKED';

// ─── Runtime registration ───────────────────────────────────────────────────

export interface RuntimeRegistrationRecord {
  id: string;
  organizationId: string;
  machineFingerprintHash: string;
  hostname: string;
  os: string;
  architecture: string;
  version: string;
  status: RuntimeStatus;
  publicKey: string;
  lastHeartbeat: string | null;
  /** Signature of the most recently accepted heartbeat — rejects verbatim replays within the timestamp tolerance window. Not exposed via any DTO. */
  lastHeartbeatSignature: string | null;
  registeredAt: string;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeRegistrationDTO {
  runtimeId: string;
  organizationId: string;
  hostname: string;
  os: string;
  architecture: string;
  version: string;
  status: RuntimeStatus;
  lastHeartbeat: string | null;
  registeredAt: string;
  activatedAt: string | null;
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

// ─── Activation keys (single-use) ───────────────────────────────────────────

export interface ActivationKeyRecord {
  id: string;
  code: string;
  organizationId: string;
  organizationCode: string;
  used: boolean;
  usedAt: string | null;
  usedByRuntimeId: string | null;
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
}

export interface RuntimeConfigDTO {
  runtimeId: string;
  certificate: string;
  organizationId: string;
  pollingInterval: number;
  heartbeatInterval: number;
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
  status?: string;
  timestamp: string;
  signature: string;
}
