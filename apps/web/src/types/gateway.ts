import type { OrgRole } from './portal';

// ─── API Keys ───────────────────────────────────────────────────────────────

export type ApiKeyStatus = 'active' | 'revoked';

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
  /** Present exactly once, right after create/regenerate — never fetchable again. */
  apiKey?: string;
}

// ─── Rate limiting ──────────────────────────────────────────────────────────

export type RateLimitWindow = 'minute' | 'hour' | 'day';

export interface RateLimitRule {
  id: string;
  organizationId: string;
  window: RateLimitWindow;
  limit: number;
  createdAt: string;
  updatedAt: string;
}

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

export interface GatewaySettings {
  organizationId: string;
  environmentId: string;
  corsAllowedOrigins: string[];
  logLevel: LogLevel;
  timeoutMs: number;
  internalBaseUrl?: string;
  updatedAt: string;
}
