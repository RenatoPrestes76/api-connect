import type { OrgRole } from '../portal-identity/types.js';

// ─── API Keys ───────────────────────────────────────────────────────────────

export type ApiKeyStatus = 'active' | 'revoked';

export interface ApiKeyRecord {
  id: string;
  organizationId: string;
  environmentId: string;
  name: string;
  /** Public, non-secret identifier — safe to display/log, e.g. "atl_pub_ab12cd34". */
  publicId: string;
  secretHash: string;
  /** The role this key acts as when authenticating — same permission table as org users. */
  role: OrgRole;
  status: ApiKeyStatus;
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface ApiKeyDTO {
  id: string;
  organizationId: string;
  environmentId: string;
  name: string;
  publicId: string;
  role: OrgRole;
  status: ApiKeyStatus;
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

// ─── Rate limiting ──────────────────────────────────────────────────────────

export type RateLimitWindow = 'minute' | 'hour' | 'day';

export interface RateLimitRuleRecord {
  id: string;
  organizationId: string;
  window: RateLimitWindow;
  limit: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_RATE_LIMITS: Record<RateLimitWindow, number> = {
  minute: 120,
  hour: 3000,
  day: 20000,
};

export const WINDOW_MS: Record<RateLimitWindow, number> = {
  minute: 60_000,
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
};

// ─── Centralized logging ────────────────────────────────────────────────────

export type ApiActorType = 'user' | 'api_key' | 'anonymous';

export interface ApiLogEntry {
  id: string;
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
  createdAt: string;
}

// ─── Per-environment gateway settings ───────────────────────────────────────

export type LogLevel = 'minimal' | 'standard' | 'verbose';

export interface GatewaySettingsRecord {
  organizationId: string;
  environmentId: string;
  corsAllowedOrigins: string[];
  logLevel: LogLevel;
  timeoutMs: number;
  internalBaseUrl?: string;
  updatedAt: string;
}

// ─── Resolved identity (shared by session + API key auth) ──────────────────

export interface ResolvedPortalIdentity {
  organizationId: string;
  role: OrgRole;
  permissions: string[];
  actorType: ApiActorType;
  actorId: string;
  actorLabel: string;
}
