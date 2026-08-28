import { randomUUID, createHash } from 'node:crypto';
import { portalIdentityStore } from '../portal-identity/portal-identity-store.js';
import { hashFingerprint } from './fingerprint.js';
import { issueCertificate } from './certificate.js';
import { needsUpdate } from './version-control.js';
import type {
  RuntimeRegistrationRecord,
  RuntimeCertificateRecord,
  ActivationKeyRecord,
  RuntimeStatus,
  RegisterRuntimeInput,
  RuntimeRegistrationDTO,
  RuntimeSessionRecord,
  RuntimeConfigRecord,
  RuntimeConfigPatch,
} from './types.js';

const DEFAULT_RUNTIME_CONFIG: Omit<RuntimeConfigRecord, 'runtimeId' | 'updatedAt'> = {
  pollingIntervalMs: 60_000,
  heartbeatIntervalMs: 30_000,
  logLevel: 'info',
  compressionEnabled: true,
  retryPolicy: { maxAttempts: 3, backoffMs: 2_000 },
  connectionTimeoutMs: 10_000,
  databaseTimeoutMs: 15_000,
};

const ACTIVATION_KEY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type RegisterRuntimeError =
  | 'ORGANIZATION_NOT_FOUND'
  | 'ACTIVATION_KEY_INVALID'
  | 'ACTIVATION_KEY_EXPIRED'
  | 'ACTIVATION_KEY_ALREADY_USED'
  | 'ACTIVATION_KEY_REVOKED'
  | 'FINGERPRINT_DUPLICATE';

export type RegisterRuntimeResult =
  | { ok: true; runtime: RuntimeRegistrationRecord; certificate: string }
  | { ok: false; error: RegisterRuntimeError };

let _instance: RuntimeRegistrationStore | null = null;

export class RuntimeRegistrationStore {
  private runtimes: RuntimeRegistrationRecord[] = [];
  private certificates: RuntimeCertificateRecord[] = [];
  private activationKeys: ActivationKeyRecord[] = [];
  private sessions: RuntimeSessionRecord[] = [];
  private configs: RuntimeConfigRecord[] = [];

  private constructor() {
    this.seedDemoActivationKey();
  }

  static getInstance(): RuntimeRegistrationStore {
    if (!_instance) _instance = new RuntimeRegistrationStore();
    return _instance;
  }

  // ─── Seed ───────────────────────────────────────────────────────────────

  private seedDemoActivationKey(): void {
    const demoOrg = portalIdentityStore.findOrganizationByCode('ORG-0001');
    if (!demoOrg) return;
    const now = new Date();
    this.activationKeys.push({
      id: randomUUID(),
      code: 'ATLAS-DEMO-0001',
      organizationId: demoOrg.id,
      organizationCode: demoOrg.internalCode,
      used: false,
      usedAt: null,
      usedByRuntimeId: null,
      revoked: false,
      revokedAt: null,
      expiresAt: new Date(now.getTime() + ACTIVATION_KEY_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    });
  }

  // ─── Activation keys ────────────────────────────────────────────────────

  issueActivationKey(organizationId: string, organizationCode: string): ActivationKeyRecord {
    const now = new Date();
    const keySuffix = randomUUID().split('-')[0] ?? randomUUID();
    const record: ActivationKeyRecord = {
      id: randomUUID(),
      code: `ATLAS-${keySuffix.toUpperCase()}`,
      organizationId,
      organizationCode,
      used: false,
      usedAt: null,
      usedByRuntimeId: null,
      revoked: false,
      revokedAt: null,
      expiresAt: new Date(now.getTime() + ACTIVATION_KEY_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    };
    this.activationKeys.push(record);
    return record;
  }

  listActivationKeys(): ActivationKeyRecord[] {
    return [...this.activationKeys];
  }

  getActivationKey(id: string): ActivationKeyRecord | undefined {
    return this.activationKeys.find((k) => k.id === id);
  }

  /** Invalidates a not-yet-consumed activation key. Never reversible — a fresh key must be issued instead. */
  revokeActivationKey(id: string): ActivationKeyRecord | null {
    const key = this.getActivationKey(id);
    if (!key || key.used || key.revoked) return null;
    key.revoked = true;
    key.revokedAt = new Date().toISOString();
    return key;
  }

  private findActivationKey(
    organizationCode: string,
    code: string
  ): ActivationKeyRecord | undefined {
    return this.activationKeys.find(
      (k) => k.organizationCode === organizationCode && k.code === code
    );
  }

  // ─── Runtimes ────────────────────────────────────────────────────────────

  findByFingerprintHash(hash: string): RuntimeRegistrationRecord | undefined {
    return this.runtimes.find((r) => r.machineFingerprintHash === hash && r.status !== 'REVOKED');
  }

  getRuntime(id: string): RuntimeRegistrationRecord | undefined {
    return this.runtimes.find((r) => r.id === id);
  }

  listRuntimes(
    filter: {
      organizationId?: string;
      controlPlaneOrganizationId?: string;
      status?: RuntimeStatus;
    } = {}
  ): RuntimeRegistrationRecord[] {
    return this.runtimes.filter((r) => {
      if (filter.organizationId && r.organizationId !== filter.organizationId) return false;
      if (
        filter.controlPlaneOrganizationId &&
        r.controlPlaneOrganizationId !== filter.controlPlaneOrganizationId
      )
        return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
  }

  async registerRuntime(input: RegisterRuntimeInput): Promise<RegisterRuntimeResult> {
    const org = portalIdentityStore.findOrganizationByCode(input.organizationCode);
    if (!org) return { ok: false, error: 'ORGANIZATION_NOT_FOUND' };

    const key = this.findActivationKey(input.organizationCode, input.activationKey);
    if (!key) return { ok: false, error: 'ACTIVATION_KEY_INVALID' };
    if (key.revoked) return { ok: false, error: 'ACTIVATION_KEY_REVOKED' };
    if (key.used) return { ok: false, error: 'ACTIVATION_KEY_ALREADY_USED' };
    if (new Date(key.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'ACTIVATION_KEY_EXPIRED' };
    }

    const fingerprintHash = hashFingerprint(input.fingerprint);
    if (this.findByFingerprintHash(fingerprintHash)) {
      return { ok: false, error: 'FINGERPRINT_DUPLICATE' };
    }

    const now = new Date();
    const runtime: RuntimeRegistrationRecord = {
      id: randomUUID(),
      organizationId: org.id,
      controlPlaneOrganizationId: org.controlPlaneOrganizationId,
      machineFingerprintHash: fingerprintHash,
      hostname: input.hostname,
      os: input.os,
      architecture: input.architecture ?? 'unknown',
      version: input.runtimeVersion,
      status: 'REGISTERED',
      publicKey: input.publicKey,
      capabilities: input.capabilities ?? [],
      lastHeartbeat: null,
      lastHeartbeatSignature: null,
      lastMemoryMb: null,
      lastCpuPercent: null,
      lastUptimeSeconds: null,
      registeredAt: now.toISOString(),
      activatedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.runtimes.push(runtime);
    this.configs.push({
      runtimeId: runtime.id,
      ...DEFAULT_RUNTIME_CONFIG,
      updatedAt: now.toISOString(),
    });

    const issued = await issueCertificate(runtime.id, input.publicKey);
    this.certificates.push({
      id: randomUUID(),
      runtimeId: runtime.id,
      publicKey: input.publicKey,
      certificateId: issued.certificateId,
      issuedAt: issued.issuedAt.toISOString(),
      expiresAt: issued.expiresAt.toISOString(),
      revoked: false,
      revokedAt: null,
    });

    key.used = true;
    key.usedAt = now.toISOString();
    key.usedByRuntimeId = runtime.id;

    return { ok: true, runtime, certificate: issued.certificate };
  }

  /** True when `signature` was already accepted for this runtime's most recent heartbeat — rejects verbatim request replay. */
  isReplayedSignature(id: string, signature: string): boolean {
    const runtime = this.getRuntime(id);
    return runtime?.lastHeartbeatSignature === signature;
  }

  recordHeartbeat(
    id: string,
    data: {
      version: string;
      status?: string;
      signature: string;
      memory?: number;
      cpu?: number;
      uptimeSeconds?: number;
      capabilities?: string[];
    }
  ): RuntimeRegistrationRecord | null {
    const runtime = this.getRuntime(id);
    if (!runtime) return null;
    if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') return null;

    const now = new Date().toISOString();
    runtime.lastHeartbeat = now;
    runtime.lastHeartbeatSignature = data.signature;
    runtime.version = data.version;
    if (data.memory !== undefined) runtime.lastMemoryMb = data.memory;
    if (data.cpu !== undefined) runtime.lastCpuPercent = data.cpu;
    if (data.uptimeSeconds !== undefined) runtime.lastUptimeSeconds = data.uptimeSeconds;
    if (data.capabilities !== undefined) runtime.capabilities = data.capabilities;
    runtime.updatedAt = now;
    if (runtime.status === 'REGISTERED' || runtime.status === 'PENDING') {
      runtime.status = 'ACTIVE';
      runtime.activatedAt = now;
    }
    return runtime;
  }

  blockRuntime(id: string): RuntimeRegistrationRecord | null {
    const runtime = this.getRuntime(id);
    if (!runtime) return null;
    runtime.status = 'BLOCKED';
    runtime.updatedAt = new Date().toISOString();
    this.revokeAllRuntimeSessions(id);
    return runtime;
  }

  reactivateRuntime(id: string): RuntimeRegistrationRecord | null {
    const runtime = this.getRuntime(id);
    if (!runtime || runtime.status !== 'BLOCKED') return null;
    runtime.status = runtime.lastHeartbeat ? 'ACTIVE' : 'REGISTERED';
    runtime.updatedAt = new Date().toISOString();
    return runtime;
  }

  // ─── Certificates ────────────────────────────────────────────────────────

  getCertificate(runtimeId: string): RuntimeCertificateRecord | undefined {
    return this.certificates.find((c) => c.runtimeId === runtimeId);
  }

  findCertificateByCertificateId(certificateId: string): RuntimeCertificateRecord | undefined {
    return this.certificates.find((c) => c.certificateId === certificateId);
  }

  revokeCertificate(runtimeId: string): RuntimeCertificateRecord | null {
    const cert = this.getCertificate(runtimeId);
    if (!cert || cert.revoked) return null;
    cert.revoked = true;
    cert.revokedAt = new Date().toISOString();
    const runtime = this.getRuntime(runtimeId);
    if (runtime) {
      runtime.status = 'REVOKED';
      runtime.updatedAt = new Date().toISOString();
      this.revokeAllRuntimeSessions(runtimeId);
    }
    return cert;
  }

  // ─── Runtime sessions (JWT auth) ─────────────────────────────────────────

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  createRuntimeSession(
    runtimeId: string,
    refreshToken: string,
    ttlSeconds: number
  ): RuntimeSessionRecord {
    const now = new Date();
    const session: RuntimeSessionRecord = {
      id: randomUUID(),
      runtimeId,
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      createdAt: now.toISOString(),
      revokedAt: null,
    };
    this.sessions.push(session);
    return session;
  }

  /** Returns the active (non-revoked, non-expired) session for a refresh token, if any. */
  findActiveRuntimeSession(refreshToken: string): RuntimeSessionRecord | undefined {
    const hash = this.hashToken(refreshToken);
    const session = this.sessions.find((s) => s.refreshTokenHash === hash);
    if (!session) return undefined;
    if (session.revokedAt) return undefined;
    if (new Date(session.expiresAt).getTime() < Date.now()) return undefined;
    return session;
  }

  revokeRuntimeSession(sessionId: string): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session && !session.revokedAt) session.revokedAt = new Date().toISOString();
  }

  revokeRuntimeSessionByRefreshToken(refreshToken: string): boolean {
    const hash = this.hashToken(refreshToken);
    const session = this.sessions.find((s) => s.refreshTokenHash === hash && !s.revokedAt);
    if (!session) return false;
    session.revokedAt = new Date().toISOString();
    return true;
  }

  /** Kills every active session for a Runtime — called on block/revoke so a JWT issued before that action stops working immediately rather than lingering until its own expiry. */
  revokeAllRuntimeSessions(runtimeId: string): void {
    const now = new Date().toISOString();
    for (const s of this.sessions) {
      if (s.runtimeId === runtimeId && !s.revokedAt) s.revokedAt = now;
    }
  }

  // ─── Runtime configuration (persisted, updatable) ────────────────────────

  getRuntimeConfig(runtimeId: string): RuntimeConfigRecord | undefined {
    return this.configs.find((c) => c.runtimeId === runtimeId);
  }

  updateRuntimeConfig(runtimeId: string, patch: RuntimeConfigPatch): RuntimeConfigRecord | null {
    const config = this.getRuntimeConfig(runtimeId);
    if (!config) return null;
    if (patch.pollingIntervalMs !== undefined) config.pollingIntervalMs = patch.pollingIntervalMs;
    if (patch.heartbeatIntervalMs !== undefined) {
      config.heartbeatIntervalMs = patch.heartbeatIntervalMs;
    }
    if (patch.logLevel !== undefined) config.logLevel = patch.logLevel;
    if (patch.compressionEnabled !== undefined)
      config.compressionEnabled = patch.compressionEnabled;
    if (patch.retryPolicy) {
      config.retryPolicy = { ...config.retryPolicy, ...patch.retryPolicy };
    }
    if (patch.connectionTimeoutMs !== undefined) {
      config.connectionTimeoutMs = patch.connectionTimeoutMs;
    }
    if (patch.databaseTimeoutMs !== undefined) config.databaseTimeoutMs = patch.databaseTimeoutMs;
    config.updatedAt = new Date().toISOString();
    return config;
  }

  // ─── DTO ─────────────────────────────────────────────────────────────────

  toDTO(runtime: RuntimeRegistrationRecord): RuntimeRegistrationDTO {
    return {
      runtimeId: runtime.id,
      organizationId: runtime.organizationId,
      controlPlaneOrganizationId: runtime.controlPlaneOrganizationId,
      hostname: runtime.hostname,
      os: runtime.os,
      architecture: runtime.architecture,
      version: runtime.version,
      status: runtime.status,
      capabilities: runtime.capabilities,
      lastHeartbeat: runtime.lastHeartbeat,
      lastMemoryMb: runtime.lastMemoryMb,
      lastCpuPercent: runtime.lastCpuPercent,
      lastUptimeSeconds: runtime.lastUptimeSeconds,
      registeredAt: runtime.registeredAt,
      activatedAt: runtime.activatedAt,
      needsUpdate: needsUpdate(runtime.version),
    };
  }
}

export const runtimeRegistrationStore = RuntimeRegistrationStore.getInstance();
