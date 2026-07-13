/**
 * @seltriva/cloud — api
 * API contracts: request/response types, middleware, route definitions.
 *
 * All API routes live in src/app/api/v1/.
 * This module defines the shared types used across all routes.
 *
 * API design:
 *   - REST + JSON
 *   - Versioned at /api/v1/
 *   - Authentication: Supabase JWT (Bearer) or API Key
 *   - All responses follow ApiResponse<T> envelope
 *   - Errors follow ApiError with machine-readable codes
 */

import type {
  OrganizationId,
  WorkspaceId,
  EnvironmentId,
  AgentId,
  UserId,
  OrganizationTier,
  MemberRole,
  EnvironmentKind,
  SemVer,
} from '../domain/index';

// ─── Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly meta?: ApiMeta;
}

export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
}

export interface ApiMeta {
  readonly requestId: string;
  readonly timestamp: string;
  readonly version: string;
  readonly pagination?: PaginationMeta;
}

export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'LICENSE_LIMIT_REACHED'
  | 'LICENSE_EXPIRED'
  | 'FEATURE_NOT_AVAILABLE'
  | 'ORGANIZATION_SUSPENDED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// ─── Request Context ──────────────────────────────────────────────────────

export interface ApiRequestContext {
  readonly requestId: string;
  readonly userId?: UserId;
  readonly organizationId?: OrganizationId;
  readonly role?: MemberRole;
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly apiKeyId?: string;
  readonly scopes?: string[];
  readonly timestamp: Date;
}

// ─── Organization Endpoints ───────────────────────────────────────────────

// POST /api/v1/organizations
export interface CreateOrganizationRequest {
  readonly name: string;
  readonly slug: string;
  readonly tier?: OrganizationTier;
}

export interface CreateOrganizationResponse {
  readonly id: OrganizationId;
  readonly slug: string;
  readonly name: string;
  readonly tier: OrganizationTier;
  readonly status: string;
  readonly createdAt: string;
}

// GET /api/v1/organizations/:id
export interface GetOrganizationResponse {
  readonly id: OrganizationId;
  readonly slug: string;
  readonly name: string;
  readonly tier: OrganizationTier;
  readonly status: string;
  readonly logoUrl?: string;
  readonly workspaceCount: number;
  readonly agentCount: number;
  readonly memberCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// POST /api/v1/organizations/:id/members/invite
export interface InviteMemberRequest {
  readonly email: string;
  readonly role: MemberRole;
}

// ─── Workspace Endpoints ──────────────────────────────────────────────────

// POST /api/v1/organizations/:orgId/workspaces
export interface CreateWorkspaceRequest {
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
}

export interface WorkspaceResponse {
  readonly id: WorkspaceId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly status: string;
  readonly environmentCount: number;
  readonly createdAt: string;
}

// ─── Environment Endpoints ────────────────────────────────────────────────

// POST /api/v1/workspaces/:workspaceId/environments
export interface CreateEnvironmentRequest {
  readonly name: string;
  readonly slug: string;
  readonly kind: EnvironmentKind;
}

export interface EnvironmentResponse {
  readonly id: EnvironmentId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly slug: string;
  readonly kind: EnvironmentKind;
  readonly status: string;
  readonly agentCount: number;
  readonly createdAt: string;
}

// ─── Agent Endpoints ──────────────────────────────────────────────────────

// POST /api/v1/agents/register
export interface RegisterAgentRequest {
  readonly organizationId: OrganizationId;
  readonly environmentId: EnvironmentId;
  readonly name: string;
  readonly version: SemVer;
  readonly hostname?: string;
  readonly platform?: string;
  readonly arch?: string;
  readonly nodeVersion?: string;
  readonly capabilities?: string[];
}

export interface RegisterAgentResponse {
  readonly agentId: AgentId;
  readonly name: string;
  readonly status: string;
  readonly registeredAt: string;
  readonly cloudEndpoint: string;
  readonly heartbeatIntervalMs: number;
}

// POST /api/v1/agents/:agentId/heartbeat
export interface AgentHeartbeatRequest {
  readonly status: string;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly diskPct?: number;
  readonly latencyMs?: number;
  readonly version?: string;
}

// GET /api/v1/agents/:agentId
export interface AgentDetailResponse {
  readonly id: AgentId;
  readonly name: string;
  readonly version: string;
  readonly status: string;
  readonly lastSeenAt?: string;
  readonly hostname?: string;
  readonly platform?: string;
  readonly arch?: string;
  readonly capabilities: string[];
  readonly organizationId: OrganizationId;
  readonly environmentId: EnvironmentId;
  readonly registeredAt: string;
  readonly updatedAt: string;
}

// POST /api/v1/agents/:agentId/commands
export interface SendAgentCommandRequest {
  readonly commandType: string;
  readonly payload: Record<string, unknown>;
  readonly expiresAt?: string;
}

// ─── Plugin Endpoints ─────────────────────────────────────────────────────

// GET /api/v1/plugins
export interface PluginListItem {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly tags: string[];
  readonly status: string;
}

// POST /api/v1/organizations/:orgId/plugins/:pluginId/install
export interface InstallPluginRequest {
  readonly version: string;
  readonly config?: Record<string, unknown>;
}

// ─── Configuration Endpoints ──────────────────────────────────────────────

// PUT /api/v1/workspaces/:workspaceId/config/:key
export interface SetConfigRequest {
  readonly value: string;
  readonly encrypted?: boolean;
  readonly description?: string;
}

export interface ConfigItemResponse {
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly value: string;
  readonly encrypted: boolean;
  readonly description?: string;
  readonly updatedAt: string;
}

// ─── API Key Endpoints ────────────────────────────────────────────────────

// POST /api/v1/organizations/:orgId/api-keys
export interface CreateApiKeyRequest {
  readonly name: string;
  readonly scopes: string[];
  readonly expiresAt?: string;
}

export interface CreateApiKeyResponse {
  readonly id: string;
  readonly name: string;
  readonly key: string;
  readonly prefix: string;
  readonly scopes: string[];
  readonly createdAt: string;
  readonly expiresAt?: string;
}

// ─── Feature Flag Endpoints ───────────────────────────────────────────────

// GET /api/v1/organizations/:orgId/feature-flags
export interface FeatureFlagResponse {
  readonly key: string;
  readonly enabled: boolean;
  readonly kind: string;
  readonly rolloutPercent?: number;
  readonly variants?: unknown[];
}

// ─── Health Endpoint ──────────────────────────────────────────────────────

// GET /api/v1/health
export interface HealthResponse {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly version: string;
  readonly timestamp: string;
  readonly checks: HealthCheckResponse[];
}

export interface HealthCheckResponse {
  readonly name: string;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly durationMs?: number;
  readonly message?: string;
}

// ─── Middleware Interfaces ────────────────────────────────────────────────

export interface IAuthMiddleware {
  authenticate(request: Request): Promise<ApiRequestContext | null>;
  requireRole(context: ApiRequestContext, minRole: MemberRole): boolean;
  requireScope(context: ApiRequestContext, scope: string): boolean;
}

export interface IValidationMiddleware {
  validate<T>(schema: unknown, data: unknown): ValidationResult<T>;
}

export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors?: Array<{ path: string; message: string }>;
}

// ─── Route Registry ───────────────────────────────────────────────────────

export const API_ROUTES = {
  // Organizations
  ORGANIZATIONS: '/api/v1/organizations',
  ORGANIZATION: '/api/v1/organizations/:id',
  ORGANIZATION_MEMBERS: '/api/v1/organizations/:id/members',
  ORGANIZATION_INVITE: '/api/v1/organizations/:id/members/invite',

  // Workspaces
  WORKSPACES: '/api/v1/organizations/:orgId/workspaces',
  WORKSPACE: '/api/v1/workspaces/:id',

  // Environments
  ENVIRONMENTS: '/api/v1/workspaces/:workspaceId/environments',
  ENVIRONMENT: '/api/v1/environments/:id',

  // Agents
  AGENT_REGISTER: '/api/v1/agents/register',
  AGENT: '/api/v1/agents/:id',
  AGENT_HEARTBEAT: '/api/v1/agents/:id/heartbeat',
  AGENT_COMMANDS: '/api/v1/agents/:id/commands',
  AGENT_TELEMETRY: '/api/v1/agents/:id/telemetry',

  // Plugins
  PLUGINS: '/api/v1/plugins',
  PLUGIN: '/api/v1/plugins/:id',
  PLUGIN_INSTALL: '/api/v1/organizations/:orgId/plugins/:pluginId/install',
  PLUGIN_UNINSTALL: '/api/v1/organizations/:orgId/plugins/:pluginId',

  // Configuration
  CONFIG: '/api/v1/workspaces/:workspaceId/config',
  CONFIG_KEY: '/api/v1/workspaces/:workspaceId/config/:key',

  // Feature Flags
  FEATURE_FLAGS: '/api/v1/organizations/:orgId/feature-flags',
  FEATURE_FLAG: '/api/v1/organizations/:orgId/feature-flags/:key',

  // API Keys
  API_KEYS: '/api/v1/organizations/:orgId/api-keys',
  API_KEY: '/api/v1/organizations/:orgId/api-keys/:id',

  // Licenses
  LICENSES: '/api/v1/organizations/:orgId/licenses',
  LICENSE_ACTIVATE: '/api/v1/organizations/:orgId/licenses/activate',

  // Audit
  AUDIT_LOG: '/api/v1/organizations/:orgId/audit',

  // Health
  HEALTH: '/api/v1/health',
  HEALTH_READY: '/api/v1/health/ready',
  HEALTH_LIVE: '/api/v1/health/live',

  // Metrics
  METRICS: '/api/v1/organizations/:orgId/metrics',

  // Notifications
  NOTIFICATIONS: '/api/v1/organizations/:orgId/notifications',
} as const;

// ─── API Scopes ───────────────────────────────────────────────────────────

export const API_SCOPES = {
  ORGANIZATIONS_READ: 'organizations:read',
  ORGANIZATIONS_WRITE: 'organizations:write',
  WORKSPACES_READ: 'workspaces:read',
  WORKSPACES_WRITE: 'workspaces:write',
  AGENTS_READ: 'agents:read',
  AGENTS_WRITE: 'agents:write',
  AGENTS_HEARTBEAT: 'agents:heartbeat',
  PLUGINS_READ: 'plugins:read',
  PLUGINS_WRITE: 'plugins:write',
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',
  AUDIT_READ: 'audit:read',
  MEMBERS_READ: 'members:read',
  MEMBERS_WRITE: 'members:write',
  LICENSES_READ: 'licenses:read',
  LICENSES_WRITE: 'licenses:write',
  METRICS_READ: 'metrics:read',
  ADMIN: 'admin:*',
} as const;
