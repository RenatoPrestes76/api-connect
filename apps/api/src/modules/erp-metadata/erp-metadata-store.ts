/**
 * apps/api never dials a customer's ERP database directly — that principle
 * has held since Sprint 46.8 and is enforced here the same way
 * services/discovery-adapter.ts already enforces it: only ever `import
 * type` from @seltriva/database-sdk (erased at compile time, zero runtime
 * driver code bundled), never its SchemaReader/Driver/ConnectionManager
 * exports. The Runtime — which does hold that dependency's live drivers —
 * performs the actual scan and reports the result back over
 * POST /erp-metadata/runtime/result.
 */
import { randomUUID } from 'node:crypto';
import { DatabaseScanner } from '@seltriva/database-intelligence';
import type { DatabaseIntelligenceReport } from '@seltriva/database-intelligence';
import { runtimeRegistrationStore } from '../runtime-registration/runtime-registration-store.js';
import { erpConnectivityStore } from '../erp-connectivity/erp-connectivity-store.js';
import { adaptDatabaseSchema } from '../../services/discovery-adapter.js';
import { computeSchemaChecksum } from './schema-checksum.js';
import { computeBackoffDelayMs, DEFAULT_MAX_ATTEMPTS, DEFAULT_TIMEOUT_MS } from './retry-policy.js';
import type {
  DiscoveryRequestRecord,
  DiscoveryRequestDTO,
  DiscoveryStatus,
  CreateDiscoveryInput,
  CreateDiscoveryError,
  ReportSchemaInput,
  ReportSchemaError,
  MetadataCacheEntry,
} from './types.js';
import { TERMINAL_DISCOVERY_STATUSES } from './types.js';

export type CreateDiscoveryResult =
  | { ok: true; request: DiscoveryRequestRecord }
  | { ok: false; error: CreateDiscoveryError };
export type ReportSchemaResult =
  | { ok: true; request: DiscoveryRequestRecord; reused: boolean }
  | { ok: false; error: ReportSchemaError };

const CACHE_TTL_MS = 30 * 60_000; // matches PrometheusStore's own eviction window

let _instance: ErpMetadataStore | null = null;

export class ErpMetadataStore {
  private requests: DiscoveryRequestRecord[] = [];
  private cache = new Map<string, MetadataCacheEntry>();
  private reports = new Map<string, { report: DatabaseIntelligenceReport; expiresAt: number }>();
  private scanner = new DatabaseScanner();

  static getInstance(): ErpMetadataStore {
    if (!_instance) _instance = new ErpMetadataStore();
    return _instance;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  createDiscoveryRequest(input: CreateDiscoveryInput): CreateDiscoveryResult {
    const runtime = runtimeRegistrationStore.getRuntime(input.runtimeId);
    if (!runtime) return { ok: false, error: 'RUNTIME_NOT_FOUND' };
    if (runtime.organizationId !== input.organizationId) {
      return { ok: false, error: 'RUNTIME_ORGANIZATION_MISMATCH' };
    }
    const profile = erpConnectivityStore.getProfile(input.profileId);
    if (!profile) return { ok: false, error: 'PROFILE_NOT_FOUND' };
    if (profile.runtimeId !== input.runtimeId)
      return { ok: false, error: 'PROFILE_RUNTIME_MISMATCH' };

    const now = new Date().toISOString();
    const request: DiscoveryRequestRecord = {
      id: randomUUID(),
      runtimeId: input.runtimeId,
      organizationId: input.organizationId,
      profileId: input.profileId,
      createdBy: input.createdBy,
      status: 'REQUESTED',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      error: null,
      createdAt: now,
      scheduledAt: now,
      claimedAt: null,
      finishedAt: null,
    };
    this.requests.push(request);
    return { ok: true, request };
  }

  getRequest(id: string): DiscoveryRequestRecord | undefined {
    return this.requests.find((r) => r.id === id);
  }

  listRequests(
    filter: { runtimeId?: string; organizationId?: string; status?: DiscoveryStatus } = {}
  ): DiscoveryRequestRecord[] {
    return this.requests.filter((r) => {
      if (filter.runtimeId && r.runtimeId !== filter.runtimeId) return false;
      if (filter.organizationId && r.organizationId !== filter.organizationId) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
  }

  toDTO(request: DiscoveryRequestRecord): DiscoveryRequestDTO {
    return {
      id: request.id,
      runtimeId: request.runtimeId,
      organizationId: request.organizationId,
      profileId: request.profileId,
      createdBy: request.createdBy,
      status: request.status,
      attempts: request.attempts,
      maxAttempts: request.maxAttempts,
      error: request.error,
      createdAt: request.createdAt,
      scheduledAt: request.scheduledAt,
      claimedAt: request.claimedAt,
      finishedAt: request.finishedAt,
    };
  }

  // ─── Claim (Runtime polls GET /erp-metadata/runtime/jobs) ────────────────

  private evaluateTimeout(request: DiscoveryRequestRecord): DiscoveryRequestRecord {
    if (TERMINAL_DISCOVERY_STATUSES.includes(request.status)) return request;
    if (request.status !== 'CLAIMED' && request.status !== 'SCANNING') return request;

    const startedAt = request.claimedAt ?? request.createdAt;
    const elapsed = Date.now() - new Date(startedAt).getTime();
    if (elapsed > request.timeoutMs) {
      this.recordFailure(request, 'Schema discovery timed out', true);
    }
    return request;
  }

  claimRequestsForRuntime(runtimeId: string): DiscoveryRequestRecord[] {
    const now = Date.now();
    const claimable = this.requests
      .map((r) => this.evaluateTimeout(r))
      .filter(
        (r) =>
          r.runtimeId === runtimeId &&
          r.status === 'REQUESTED' &&
          new Date(r.scheduledAt).getTime() <= now
      );

    const claimedAt = new Date().toISOString();
    for (const request of claimable) {
      request.status = 'CLAIMED';
      request.claimedAt = claimedAt;
    }
    return claimable;
  }

  private recordFailure(request: DiscoveryRequestRecord, error: string, isTimeout: boolean): void {
    request.attempts += 1;
    request.error = error;

    if (request.attempts < request.maxAttempts) {
      request.status = 'REQUESTED';
      request.claimedAt = null;
      request.scheduledAt = new Date(
        Date.now() + computeBackoffDelayMs(request.attempts)
      ).toISOString();
    } else {
      request.status = isTimeout ? 'TIMEOUT' : 'FAILED';
      request.finishedAt = new Date().toISOString();
    }
  }

  // ─── Report (Runtime reports its scan result) ────────────────────────────

  /**
   * Runs the Runtime-reported raw schema through the already-built ATHENA
   * classifier (DatabaseScanner) — but only when its checksum actually
   * differs from the last cached one for this profile. An unchanged ERP
   * structure (the overwhelmingly common case on a re-scan) short-circuits
   * straight to "reused: true" without paying for classification again.
   */
  async reportSchema(input: ReportSchemaInput): Promise<ReportSchemaResult> {
    const request = this.getRequest(input.requestId);
    if (!request) return { ok: false, error: 'REQUEST_NOT_FOUND' };
    if (request.runtimeId !== input.runtimeId) return { ok: false, error: 'RUNTIME_MISMATCH' };

    if (TERMINAL_DISCOVERY_STATUSES.includes(request.status)) {
      return { ok: true, request, reused: true };
    }

    if (!input.success || !input.schema) {
      this.recordFailure(request, input.error ?? 'Runtime reported a failed schema scan', false);
      return { ok: true, request, reused: false };
    }

    request.status = 'SCANNING';
    const checksum = computeSchemaChecksum(input.schema);
    const existingCache = this.cache.get(request.profileId);

    let reused = false;
    if (existingCache && existingCache.checksum === checksum) {
      reused = true;
      existingCache.lastDiscoveredAt = new Date().toISOString();
      existingCache.lastRequestId = request.id;
    } else {
      const profile = erpConnectivityStore.getProfile(request.profileId);
      const dbInput = adaptDatabaseSchema(input.schema, {
        host: profile?.host,
        port: profile?.port,
        database: profile?.database,
      });
      const report = await this.scanner.scan(dbInput);
      const now = new Date().toISOString();
      this.reports.set(request.profileId, { report, expiresAt: Date.now() + CACHE_TTL_MS });
      this.cache.set(request.profileId, {
        profileId: request.profileId,
        checksum,
        version: (existingCache?.version ?? 0) + 1,
        lastDiscoveredAt: now,
        lastRequestId: request.id,
      });
    }

    request.attempts += 1;
    request.status = 'COMPLETED';
    request.error = null;
    request.finishedAt = new Date().toISOString();
    return { ok: true, request, reused };
  }

  // ─── Cached results (GET /erp-metadata/*) ────────────────────────────────

  getCacheMeta(profileId: string): MetadataCacheEntry | undefined {
    return this.cache.get(profileId);
  }

  getReport(profileId: string): DatabaseIntelligenceReport | undefined {
    const entry = this.reports.get(profileId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.reports.delete(profileId);
      this.cache.delete(profileId);
      return undefined;
    }
    return entry.report;
  }
}

export const erpMetadataStore = ErpMetadataStore.getInstance();
