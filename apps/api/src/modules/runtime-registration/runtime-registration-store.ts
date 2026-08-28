import { randomUUID, createHash } from 'node:crypto';
import { portalIdentityStore } from '../portal-identity/portal-identity-store.js';
import { hashFingerprint } from './fingerprint.js';
import { issueCertificate } from './certificate.js';
import { needsUpdate } from './version-control.js';
import { classifyLiveness, type RuntimeLiveness } from './liveness.js';
import { runtimeRegistrationRepository } from './runtime-registration.repository.js';
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
  | 'FINGERPRINT_DUPLICATE'
  | 'PUBLIC_KEY_ALREADY_REGISTERED';

export type RegisterRuntimeResult =
  | { ok: true; runtime: RuntimeRegistrationRecord; certificate: string }
  | { ok: false; error: RegisterRuntimeError };

let _instance: RuntimeRegistrationStore | null = null;

export class RuntimeRegistrationStore {
  // Runtime registrations themselves are Prisma-backed as of ATLAS 46.22
  // (runtime-registration.repository.ts) — no in-memory array here anymore.
  // Activation keys/certificates/sessions/config remain in-memory,
  // deliberately out of this sprint's scope (see the repository's own
  // header comment).
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

  // ─── Runtimes (Prisma-backed — ATLAS 46.22, see runtime-registration.repository.ts) ──

  async findByFingerprintHash(hash: string): Promise<RuntimeRegistrationRecord | undefined> {
    return runtimeRegistrationRepository.findByFingerprintHash(hash);
  }

  async getRuntime(id: string): Promise<RuntimeRegistrationRecord | undefined> {
    return runtimeRegistrationRepository.findById(id);
  }

  async listRuntimes(
    filter: {
      organizationId?: string;
      controlPlaneOrganizationId?: string;
      status?: RuntimeStatus;
      tenantId?: string;
      /**
       * ATLAS 46.25, Part B — liveness has no column to filter on at the
       * database level (it's never persisted — see liveness.ts's header
       * comment), so this is applied here, after the persisted-data
       * filters above already ran at the database level, by classifying
       * each remaining row the exact same way `toDTO()` does.
       */
      liveness?: RuntimeLiveness;
    } = {}
  ): Promise<RuntimeRegistrationRecord[]> {
    const { liveness, ...persistedFilter } = filter;
    const rows = await runtimeRegistrationRepository.list(persistedFilter);
    if (!liveness) return rows;
    const now = new Date();
    return rows.filter((r) => classifyLiveness(r.lastHeartbeat, now) === liveness);
  }

  /**
   * ATLAS 46.25, Part C — a minimal operational summary: how many Runtimes
   * (optionally scoped to one Organization/Control-Plane-Organization/
   * Tenant) are currently ONLINE/STALE/OFFLINE. Computed live from the same
   * persisted rows `listRuntimes` reads — no persisted counter, no cache,
   * so the numbers can never drift from what `listRuntimes` itself would
   * return for the same scope.
   */
  async getOperationalSummary(
    filter: {
      organizationId?: string;
      controlPlaneOrganizationId?: string;
      tenantId?: string;
    } = {}
  ): Promise<{ total: number; online: number; stale: number; offline: number }> {
    const rows = await runtimeRegistrationRepository.list(filter);
    const now = new Date();
    const summary = { total: rows.length, online: 0, stale: 0, offline: 0 };
    for (const row of rows) {
      const liveness = classifyLiveness(row.lastHeartbeat, now);
      if (liveness === 'ONLINE') summary.online++;
      else if (liveness === 'STALE') summary.stale++;
      else summary.offline++;
    }
    return summary;
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

    // The repository's own unique constraints (machineFingerprintHash,
    // publicKey) are the real, race-proof guard — this pre-check only
    // exists to fail fast with the same error before spending an
    // activation-key consumption on a request that's going to be rejected
    // anyway.
    if (await this.findByFingerprintHash(fingerprintHash)) {
      return { ok: false, error: 'FINGERPRINT_DUPLICATE' };
    }
    if (await runtimeRegistrationRepository.findByPublicKey(input.publicKey)) {
      return { ok: false, error: 'PUBLIC_KEY_ALREADY_REGISTERED' };
    }

    const created = await runtimeRegistrationRepository.create({
      organizationId: org.id,
      controlPlaneOrganizationId: org.controlPlaneOrganizationId,
      machineFingerprintHash: fingerprintHash,
      publicKey: input.publicKey,
      hostname: input.hostname,
      os: input.os,
      architecture: input.architecture ?? 'unknown',
      version: input.runtimeVersion,
      capabilities: input.capabilities ?? [],
    });
    if (!created.ok) return { ok: false, error: created.error };
    const runtime = created.runtime;

    const now = new Date();
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
  async isReplayedSignature(id: string, signature: string): Promise<boolean> {
    const runtime = await this.getRuntime(id);
    return runtime?.lastHeartbeatSignature === signature;
  }

  async recordHeartbeat(
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
  ): Promise<RuntimeRegistrationRecord | null> {
    const runtime = await this.getRuntime(id);
    if (!runtime) return null;
    if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') return null;

    const activate = runtime.status === 'REGISTERED' || runtime.status === 'PENDING';
    const updated = await runtimeRegistrationRepository.recordHeartbeat(id, {
      version: data.version,
      signature: data.signature,
      memory: data.memory,
      cpu: data.cpu,
      uptimeSeconds: data.uptimeSeconds,
      capabilities: data.capabilities,
      activate,
    });
    return updated ?? null;
  }

  async blockRuntime(id: string): Promise<RuntimeRegistrationRecord | null> {
    const updated = await runtimeRegistrationRepository.updateStatus(id, 'BLOCKED');
    if (!updated) return null;
    this.revokeAllRuntimeSessions(id);
    return updated;
  }

  async reactivateRuntime(id: string): Promise<RuntimeRegistrationRecord | null> {
    const runtime = await this.getRuntime(id);
    if (!runtime || runtime.status !== 'BLOCKED') return null;
    const nextStatus: RuntimeStatus = runtime.lastHeartbeat ? 'ACTIVE' : 'REGISTERED';
    const updated = await runtimeRegistrationRepository.updateStatus(id, nextStatus);
    return updated ?? null;
  }

  // ─── Certificates ────────────────────────────────────────────────────────

  getCertificate(runtimeId: string): RuntimeCertificateRecord | undefined {
    return this.certificates.find((c) => c.runtimeId === runtimeId);
  }

  findCertificateByCertificateId(certificateId: string): RuntimeCertificateRecord | undefined {
    return this.certificates.find((c) => c.certificateId === certificateId);
  }

  async revokeCertificate(runtimeId: string): Promise<RuntimeCertificateRecord | null> {
    const cert = this.getCertificate(runtimeId);
    if (!cert || cert.revoked) return null;
    cert.revoked = true;
    cert.revokedAt = new Date().toISOString();
    const runtime = await runtimeRegistrationRepository.updateStatus(runtimeId, 'REVOKED');
    if (runtime) {
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
      liveness: classifyLiveness(runtime.lastHeartbeat, new Date()),
    };
  }
}

export const runtimeRegistrationStore = RuntimeRegistrationStore.getInstance();
