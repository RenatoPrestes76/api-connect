import { randomUUID } from 'node:crypto';
import type {
  ApiKeyRecord,
  ApiKeyDTO,
  RateLimitRuleRecord,
  RateLimitWindow,
  ApiLogEntry,
  ApiActorType,
  GatewaySettingsRecord,
  LogLevel,
} from './types.js';
import { DEFAULT_RATE_LIMITS, WINDOW_MS } from './types.js';
import type { OrgRole } from '../portal-identity/types.js';

const MAX_LOG_ENTRIES = 5000;

let _instance: GatewayStore | null = null;

export class GatewayStore {
  private apiKeys: ApiKeyRecord[] = [];
  private rateLimitRules: RateLimitRuleRecord[] = [];
  private logs: ApiLogEntry[] = [];
  private settings: GatewaySettingsRecord[] = [];
  /** organizationId:window → { windowStart, count } — fixed-window counters. */
  private counters = new Map<string, { windowStart: number; count: number }>();

  private constructor() {}

  static getInstance(): GatewayStore {
    if (!_instance) _instance = new GatewayStore();
    return _instance;
  }

  // ─── API Keys ───────────────────────────────────────────────────────────

  listApiKeys(organizationId: string): ApiKeyRecord[] {
    return this.apiKeys.filter((k) => k.organizationId === organizationId);
  }

  findApiKeyByPublicId(publicId: string): ApiKeyRecord | undefined {
    return this.apiKeys.find((k) => k.publicId === publicId);
  }

  findApiKeyById(organizationId: string, id: string): ApiKeyRecord | undefined {
    return this.apiKeys.find((k) => k.id === id && k.organizationId === organizationId);
  }

  createApiKey(input: {
    organizationId: string;
    environmentId: string;
    name: string;
    role: OrgRole;
    publicId: string;
    secretHash: string;
  }): ApiKeyRecord {
    const key: ApiKeyRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      environmentId: input.environmentId,
      name: input.name,
      publicId: input.publicId,
      secretHash: input.secretHash,
      role: input.role,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.apiKeys.push(key);
    return key;
  }

  revokeApiKey(organizationId: string, id: string): ApiKeyRecord | null {
    const key = this.findApiKeyById(organizationId, id);
    if (!key || key.status === 'revoked') return null;
    key.status = 'revoked';
    key.revokedAt = new Date().toISOString();
    return key;
  }

  /** Revokes the old key and creates a fresh secret under the same name/role/environment. */
  regenerateApiKey(
    organizationId: string,
    id: string,
    input: { publicId: string; secretHash: string }
  ): ApiKeyRecord | null {
    const existing = this.findApiKeyById(organizationId, id);
    if (!existing || existing.status === 'revoked') return null;
    existing.publicId = input.publicId;
    existing.secretHash = input.secretHash;
    return existing;
  }

  recordApiKeyUsage(id: string): void {
    const key = this.apiKeys.find((k) => k.id === id);
    if (key) key.lastUsedAt = new Date().toISOString();
  }

  toApiKeyDTO(key: ApiKeyRecord): ApiKeyDTO {
    const { secretHash: _secretHash, ...dto } = key;
    return dto;
  }

  // ─── Rate limiting ────────────────────────────────────────────────────────

  listRateLimitRules(organizationId: string): RateLimitRuleRecord[] {
    return this.rateLimitRules.filter((r) => r.organizationId === organizationId);
  }

  upsertRateLimitRule(
    organizationId: string,
    window: RateLimitWindow,
    limit: number
  ): RateLimitRuleRecord {
    const now = new Date().toISOString();
    const existing = this.rateLimitRules.find(
      (r) => r.organizationId === organizationId && r.window === window
    );
    if (existing) {
      existing.limit = limit;
      existing.updatedAt = now;
      return existing;
    }
    const rule: RateLimitRuleRecord = {
      id: randomUUID(),
      organizationId,
      window,
      limit,
      createdAt: now,
      updatedAt: now,
    };
    this.rateLimitRules.push(rule);
    return rule;
  }

  deleteRateLimitRule(organizationId: string, id: string): boolean {
    const idx = this.rateLimitRules.findIndex(
      (r) => r.id === id && r.organizationId === organizationId
    );
    if (idx === -1) return false;
    this.rateLimitRules.splice(idx, 1);
    return true;
  }

  private effectiveLimit(organizationId: string, window: RateLimitWindow): number {
    const rule = this.rateLimitRules.find(
      (r) => r.organizationId === organizationId && r.window === window
    );
    return rule?.limit ?? DEFAULT_RATE_LIMITS[window];
  }

  /**
   * Fixed-window counter per organization+window. Returns the first window
   * that's exceeded (if any), plus enough info to build standard rate-limit
   * response headers.
   */
  checkRateLimit(organizationId: string): {
    exceeded: boolean;
    window?: RateLimitWindow;
    limit?: number;
    remaining?: number;
    resetAt?: number;
  } {
    const now = Date.now();
    const windows: RateLimitWindow[] = ['minute', 'hour', 'day'];

    for (const window of windows) {
      const key = `${organizationId}:${window}`;
      const windowMs = WINDOW_MS[window];
      const limit = this.effectiveLimit(organizationId, window);
      let counter = this.counters.get(key);

      if (!counter || now - counter.windowStart >= windowMs) {
        counter = { windowStart: now, count: 0 };
        this.counters.set(key, counter);
      }

      if (counter.count >= limit) {
        return {
          exceeded: true,
          window,
          limit,
          remaining: 0,
          resetAt: counter.windowStart + windowMs,
        };
      }
    }

    // No window exceeded — commit the increment across all windows.
    for (const window of windows) {
      const key = `${organizationId}:${window}`;
      const counter = this.counters.get(key);
      if (counter) counter.count += 1;
    }

    return { exceeded: false };
  }

  // ─── Centralized logging ────────────────────────────────────────────────

  recordLog(entry: {
    organizationId: string | null;
    environmentId?: string;
    endpoint: string;
    method: string;
    actorType: ApiActorType;
    actorId?: string;
    actorLabel: string;
    ip: string;
    statusCode: number;
    responseTimeMs: number;
  }): void {
    this.logs.push({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
    });
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_ENTRIES);
    }
  }

  listLogs(organizationId: string, filters: { limit?: number } = {}): ApiLogEntry[] {
    let list = this.logs
      .filter((l) => l.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.limit) list = list.slice(0, filters.limit);
    return list;
  }

  // ─── Per-environment gateway settings ────────────────────────────────────

  getSettings(organizationId: string, environmentId: string): GatewaySettingsRecord {
    const existing = this.settings.find(
      (s) => s.organizationId === organizationId && s.environmentId === environmentId
    );
    if (existing) return existing;
    return {
      organizationId,
      environmentId,
      corsAllowedOrigins: [],
      logLevel: 'standard',
      timeoutMs: 30_000,
      updatedAt: new Date().toISOString(),
    };
  }

  updateSettings(
    organizationId: string,
    environmentId: string,
    patch: Partial<{
      corsAllowedOrigins: string[];
      logLevel: LogLevel;
      timeoutMs: number;
      internalBaseUrl: string;
    }>
  ): GatewaySettingsRecord {
    const current = this.getSettings(organizationId, environmentId);
    const updated: GatewaySettingsRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const idx = this.settings.findIndex(
      (s) => s.organizationId === organizationId && s.environmentId === environmentId
    );
    if (idx === -1) this.settings.push(updated);
    else this.settings[idx] = updated;
    return updated;
  }
}

export const gatewayStore = GatewayStore.getInstance();
