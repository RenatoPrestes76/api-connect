import { randomUUID } from 'node:crypto';
import { CircuitBreakerRegistry, CircuitOpenError } from '@seltriva/titan';
import { runtimeRegistrationStore } from '../runtime-registration/runtime-registration-store.js';
import { encryptCredential, decryptCredential, maskSecretsInText } from './credential-store.js';
import {
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_CIRCUIT_TIMEOUT_MS,
  computeReconnectDelayMs,
  HEALTH_HISTORY_LIMIT,
} from './retry-policy.js';
import type {
  ConnectionProfileRecord,
  ConnectionProfileDTO,
  ConnectionProfileWithCredentialDTO,
  ConnectionHealthRecord,
  DiagnosticsReportRecord,
  CreateConnectionProfileInput,
  UpdateConnectionProfileInput,
  CreateProfileError,
  ProfileNotFoundError,
  ReportHealthInput,
  ReportHealthError,
  ReportHealthOutcome,
  ReportDiagnosticsInput,
  ReportDiagnosticsError,
  ConnectionStatus,
} from './types.js';

export type CreateProfileResult =
  | { ok: true; profile: ConnectionProfileRecord }
  | { ok: false; error: CreateProfileError };
export type UpdateProfileResult =
  | { ok: true; profile: ConnectionProfileRecord }
  | { ok: false; error: ProfileNotFoundError };
export type DeleteProfileResult = { ok: true } | { ok: false; error: ProfileNotFoundError };
export type ReportHealthResult =
  | ({ ok: true } & ReportHealthOutcome)
  | { ok: false; error: ReportHealthError };
export type ReportDiagnosticsResult =
  | { ok: true; report: DiagnosticsReportRecord }
  | { ok: false; error: ReportDiagnosticsError };

let _instance: ErpConnectivityStore | null = null;

export class ErpConnectivityStore {
  private profiles: ConnectionProfileRecord[] = [];
  private health = new Map<string, ConnectionHealthRecord>();
  private diagnostics = new Map<string, DiagnosticsReportRecord>();
  private lastHealthSignature = new Map<string, string>();
  private lastDiagnosticsSignature = new Map<string, string>();
  private circuits = new CircuitBreakerRegistry();

  static getInstance(): ErpConnectivityStore {
    if (!_instance) _instance = new ErpConnectivityStore();
    return _instance;
  }

  // ─── Profiles ────────────────────────────────────────────────────────────

  createProfile(input: CreateConnectionProfileInput): CreateProfileResult {
    const runtime = runtimeRegistrationStore.getRuntime(input.runtimeId);
    if (!runtime) return { ok: false, error: 'RUNTIME_NOT_FOUND' };
    if (runtime.organizationId !== input.organizationId) {
      return { ok: false, error: 'RUNTIME_ORGANIZATION_MISMATCH' };
    }

    const now = new Date().toISOString();
    const profile: ConnectionProfileRecord = {
      id: randomUUID(),
      runtimeId: input.runtimeId,
      organizationId: input.organizationId,
      name: input.name,
      erpName: input.erpName ?? null,
      dbType: input.dbType,
      host: input.host,
      port: input.port,
      database: input.database,
      username: input.username,
      encryptedCredential: encryptCredential(input.password),
      additionalParams: input.additionalParams ?? {},
      status: 'PENDING_VALIDATION',
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.push(profile);
    this.health.set(profile.id, {
      profileId: profile.id,
      responseTimeMs: null,
      activeConnections: 0,
      consecutiveFailures: 0,
      availabilityPercent: 100,
      avgQueryTimeMs: null,
      lastCheckAt: null,
      circuitState: 'CLOSED',
      nextRetryAt: null,
      history: [],
    });
    return { ok: true, profile };
  }

  getProfile(id: string): ConnectionProfileRecord | undefined {
    return this.profiles.find((p) => p.id === id);
  }

  listProfiles(
    filter: { runtimeId?: string; organizationId?: string; status?: ConnectionStatus } = {}
  ): ConnectionProfileRecord[] {
    return this.profiles.filter((p) => {
      if (filter.runtimeId && p.runtimeId !== filter.runtimeId) return false;
      if (filter.organizationId && p.organizationId !== filter.organizationId) return false;
      if (filter.status && p.status !== filter.status) return false;
      return true;
    });
  }

  updateProfile(
    id: string,
    patch: UpdateConnectionProfileInput
  ): UpdateProfileResult & { credentialRotated?: boolean } {
    const profile = this.getProfile(id);
    if (!profile) return { ok: false, error: 'PROFILE_NOT_FOUND' };

    if (patch.name !== undefined) profile.name = patch.name;
    if (patch.erpName !== undefined) profile.erpName = patch.erpName;
    if (patch.host !== undefined) profile.host = patch.host;
    if (patch.port !== undefined) profile.port = patch.port;
    if (patch.database !== undefined) profile.database = patch.database;
    if (patch.username !== undefined) profile.username = patch.username;
    if (patch.additionalParams !== undefined) profile.additionalParams = patch.additionalParams;

    let credentialRotated = false;
    if (patch.password !== undefined) {
      profile.encryptedCredential = encryptCredential(patch.password);
      credentialRotated = true;
    }
    profile.updatedAt = new Date().toISOString();
    return { ok: true, profile, credentialRotated };
  }

  deleteProfile(id: string): DeleteProfileResult {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) return { ok: false, error: 'PROFILE_NOT_FOUND' };
    this.profiles.splice(index, 1);
    this.health.delete(id);
    this.diagnostics.delete(id);
    this.lastHealthSignature.delete(id);
    this.lastDiagnosticsSignature.delete(id);
    return { ok: true };
  }

  /** Decrypted credential — only for the Runtime-profiles fetch (its own authenticated JWT session), never logged or persisted elsewhere. */
  toRuntimeDTO(profile: ConnectionProfileRecord): ConnectionProfileWithCredentialDTO {
    return { ...this.toDTO(profile), password: decryptCredential(profile.encryptedCredential) };
  }

  toDTO(profile: ConnectionProfileRecord): ConnectionProfileDTO {
    return {
      id: profile.id,
      runtimeId: profile.runtimeId,
      organizationId: profile.organizationId,
      name: profile.name,
      erpName: profile.erpName,
      dbType: profile.dbType,
      host: profile.host,
      port: profile.port,
      database: profile.database,
      username: profile.username,
      hasCredential: Boolean(profile.encryptedCredential),
      additionalParams: profile.additionalParams,
      status: profile.status,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  // ─── Health monitoring ───────────────────────────────────────────────────

  getHealth(profileId: string): ConnectionHealthRecord | undefined {
    return this.health.get(profileId);
  }

  isReplayedHealthSignature(profileId: string, signature: string): boolean {
    return this.lastHealthSignature.get(profileId) === signature;
  }

  /**
   * Records a Runtime-reported health check outcome and drives this
   * profile's circuit breaker (reused from packages/titan — no bespoke
   * breaker implementation here). The breaker has no public
   * recordSuccess/recordFailure, so the boolean outcome is replayed through
   * execute() as an immediately resolved/rejected promise, which is exactly
   * what its state machine is designed to observe.
   */
  async reportHealth(input: ReportHealthInput): Promise<ReportHealthResult> {
    const profile = this.getProfile(input.profileId);
    if (!profile) return { ok: false, error: 'PROFILE_NOT_FOUND' };
    if (profile.runtimeId !== input.runtimeId) return { ok: false, error: 'RUNTIME_MISMATCH' };

    const health = this.health.get(profile.id);
    if (!health) return { ok: false, error: 'PROFILE_NOT_FOUND' };
    const breaker = this.circuits.register(`erp-connection:${profile.id}`, {
      failureThreshold: DEFAULT_FAILURE_THRESHOLD,
      timeout: DEFAULT_CIRCUIT_TIMEOUT_MS,
    });

    const hadFailures = health.consecutiveFailures > 0;
    const error = input.error ? maskSecretsInText(input.error) : null;

    try {
      await breaker.execute(async () => {
        if (!input.success) throw new Error(error ?? 'Health check reported failure');
      });
    } catch {
      // CircuitOpenError or the wrapped failure — state is already recorded either way.
    }

    const now = new Date().toISOString();
    health.history.push({
      at: now,
      success: input.success,
      responseTimeMs: input.responseTimeMs ?? null,
      error,
    });
    if (health.history.length > HEALTH_HISTORY_LIMIT) health.history.shift();

    health.consecutiveFailures = input.success ? 0 : health.consecutiveFailures + 1;
    health.responseTimeMs = input.responseTimeMs ?? health.responseTimeMs;
    if (input.activeConnections !== undefined) health.activeConnections = input.activeConnections;
    if (input.avgQueryTimeMs !== undefined) {
      health.avgQueryTimeMs =
        health.avgQueryTimeMs === null
          ? input.avgQueryTimeMs
          : Math.round((health.avgQueryTimeMs + input.avgQueryTimeMs) / 2);
    }
    health.lastCheckAt = now;
    const successCount = health.history.filter((h) => h.success).length;
    health.availabilityPercent = Math.round((successCount / health.history.length) * 100);
    health.circuitState = breaker.getState();
    health.nextRetryAt =
      health.consecutiveFailures > 0
        ? new Date(Date.now() + computeReconnectDelayMs(health.consecutiveFailures)).toISOString()
        : null;

    profile.status =
      health.circuitState === 'OPEN'
        ? 'CIRCUIT_OPEN'
        : health.circuitState === 'HALF_OPEN'
          ? 'RECONNECTING'
          : input.success
            ? 'HEALTHY'
            : health.consecutiveFailures > 0
              ? 'DEGRADED'
              : profile.status;
    profile.updatedAt = now;

    const reconnected = hadFailures && profile.status === 'HEALTHY';
    this.lastHealthSignature.set(profile.id, input.signature);
    return { ok: true, health: { ...health }, reconnected };
  }

  // ─── Diagnostics ─────────────────────────────────────────────────────────

  getDiagnostics(profileId: string): DiagnosticsReportRecord | undefined {
    return this.diagnostics.get(profileId);
  }

  isReplayedDiagnosticsSignature(profileId: string, signature: string): boolean {
    return this.lastDiagnosticsSignature.get(profileId) === signature;
  }

  reportDiagnostics(input: ReportDiagnosticsInput): ReportDiagnosticsResult {
    const profile = this.getProfile(input.profileId);
    if (!profile) return { ok: false, error: 'PROFILE_NOT_FOUND' };
    if (profile.runtimeId !== input.runtimeId) return { ok: false, error: 'RUNTIME_MISMATCH' };

    const overallOk =
      input.dns === 'OK' &&
      input.tcp === 'OK' &&
      input.authentication === 'OK' &&
      input.database === 'OK' &&
      input.permissions === 'OK';

    const report: DiagnosticsReportRecord = {
      id: randomUUID(),
      profileId: profile.id,
      runtimeId: profile.runtimeId,
      dns: input.dns,
      tcp: input.tcp,
      authentication: input.authentication,
      database: input.database,
      latencyMs: input.latencyMs ?? null,
      permissions: input.permissions,
      driver: input.driver,
      encryption: input.encryption,
      overallOk,
      createdAt: new Date().toISOString(),
    };
    this.diagnostics.set(profile.id, report);
    this.lastDiagnosticsSignature.set(profile.id, input.signature);
    return { ok: true, report };
  }
}

export const erpConnectivityStore = ErpConnectivityStore.getInstance();
export { CircuitOpenError };
