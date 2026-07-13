/**
 * @seltriva/cloud — audit
 * Immutable audit logging for all platform operations.
 *
 * Audit entries are append-only — they are never updated or deleted.
 * The audit module supports export and compliance querying.
 */

import type {
  OrganizationId,
  UserId,
  AuditEntryId,
  DomainResult,
  PaginatedResult,
} from '../domain/index';

// ─── Audit Service ────────────────────────────────────────────────────────

export interface IAuditService {
  /**
   * Append an audit entry (fire-and-forget in most cases)
   */
  log(entry: AuditLogRequest): Promise<void>;

  /**
   * Query audit entries with filtering and pagination
   */
  query(filter: AuditQueryFilter): Promise<PaginatedResult<AuditLogEntry>>;

  /**
   * Export audit entries to a file (CSV or JSON)
   */
  export(request: AuditExportRequest): Promise<DomainResult<AuditExportResult>>;

  /**
   * Get audit statistics for an organization
   */
  getStats(orgId: OrganizationId, period: AuditPeriod): Promise<AuditStats>;
}

// ─── Audit Log Entry ──────────────────────────────────────────────────────

export interface AuditLogEntry {
  readonly id: AuditEntryId;
  readonly organizationId?: OrganizationId;
  readonly actorId?: UserId;
  readonly actorEmail?: string;
  readonly action: AuditAction;
  readonly outcome: AuditOutcome;
  readonly resource: AuditResource;
  readonly resourceId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt: Date;
}

export interface AuditLogRequest {
  readonly organizationId?: OrganizationId;
  readonly actorId?: UserId;
  readonly action: AuditAction;
  readonly outcome: AuditOutcome;
  readonly resource: AuditResource;
  readonly resourceId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: Record<string, unknown>;
}

// ─── Enumerations ─────────────────────────────────────────────────────────

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export type AuditResource =
  | 'organization'
  | 'workspace'
  | 'environment'
  | 'agent'
  | 'user'
  | 'member'
  | 'plugin'
  | 'license'
  | 'api-key'
  | 'configuration'
  | 'feature-flag'
  | 'job'
  | 'notification';

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'invite'
  | 'accept-invite'
  | 'revoke-access'
  | 'activate'
  | 'suspend'
  | 'rotate-key'
  | 'install-plugin'
  | 'uninstall-plugin'
  | 'register-agent'
  | 'deregister-agent'
  | 'send-command'
  | 'apply-update'
  | 'export-data'
  | 'api-key-used';

// ─── Query Types ──────────────────────────────────────────────────────────

export interface AuditQueryFilter {
  readonly organizationId?: OrganizationId;
  readonly actorId?: UserId;
  readonly actions?: AuditAction[];
  readonly resources?: AuditResource[];
  readonly outcome?: AuditOutcome;
  readonly since?: Date;
  readonly until?: Date;
  readonly page?: number;
  readonly pageSize?: number;
}

// ─── Export Types ─────────────────────────────────────────────────────────

export interface AuditExportRequest {
  readonly organizationId: OrganizationId;
  readonly format: 'csv' | 'json';
  readonly filter?: AuditQueryFilter;
  readonly requestedBy: UserId;
}

export interface AuditExportResult {
  readonly exportId: string;
  readonly format: string;
  readonly fileUrl: string;
  readonly entryCount: number;
  readonly sizeBytes: number;
  readonly expiresAt: Date;
  readonly generatedAt: Date;
}

// ─── Statistics ───────────────────────────────────────────────────────────

export interface AuditStats {
  readonly organizationId: OrganizationId;
  readonly period: AuditPeriod;
  readonly totalEntries: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly topActions: Array<{ action: AuditAction; count: number }>;
  readonly topActors: Array<{ actorId: UserId; count: number }>;
  readonly securityEvents: number;
}

export interface AuditPeriod {
  readonly from: Date;
  readonly to: Date;
}

// ─── Audit Middleware ─────────────────────────────────────────────────────

export interface IAuditMiddleware {
  /**
   * Automatically log an API request/response
   */
  log(request: AuditableRequest, response: AuditableResponse): void;
}

export interface AuditableRequest {
  readonly method: string;
  readonly path: string;
  readonly actorId?: UserId;
  readonly organizationId?: OrganizationId;
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly body?: unknown;
}

export interface AuditableResponse {
  readonly statusCode: number;
  readonly durationMs: number;
  readonly body?: unknown;
}
