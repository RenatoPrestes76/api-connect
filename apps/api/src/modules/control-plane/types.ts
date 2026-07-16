// Mirrors apps/cloud/prisma/schema.prisma field-for-field so a future swap to
// real Prisma-backed persistence is a drop-in replacement, not a rewrite.

// ─── Tenants ────────────────────────────────────────────────────────────────

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CHURNED';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  primaryContactEmail?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Organizations ──────────────────────────────────────────────────────────

export type OrganizationTier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'DELETED';

export interface Organization {
  id: string;
  tenantId?: string;
  slug: string;
  name: string;
  tier: OrganizationTier;
  status: OrganizationStatus;
  logoUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Projects ───────────────────────────────────────────────────────────────
// Sprint 46.4 (Atlas Control Plane Core Modules) — a labeling/grouping layer
// under an Organization. Additive only: Environments still attach directly to
// Organization, unchanged from before this sprint.

export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Workspaces (internal — one default workspace per org, not user-facing) ──

export type WorkspaceStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Environments ───────────────────────────────────────────────────────────

export type EnvironmentKind = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type EnvironmentStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

export interface Environment {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  slug: string;
  kind: EnvironmentKind;
  status: EnvironmentStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Runtimes (Agents) ──────────────────────────────────────────────────────

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNRESPONSIVE' | 'RETIRED';

export interface Runtime {
  id: string;
  organizationId: string;
  environmentId: string;
  name: string;
  version: string;
  status: AgentStatus;
  lastSeenAt?: string;
  registeredAt: string;
  hostname?: string;
  ipAddress?: string;
  platform?: string;
  arch?: string;
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
  retiredAt?: string;
}

export interface RuntimeAccessToken {
  id: string;
  runtimeId: string;
  tokenHash: string;
  tokenPrefix: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}

// ─── Connectors (Plugins) ───────────────────────────────────────────────────

export type PluginStatus = 'PUBLISHED' | 'DRAFT' | 'DEPRECATED' | 'ARCHIVED';

export interface Connector {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  publisherId: string;
  status: PluginStatus;
  category: string;
  tags: string[];
  homepage?: string;
  repository?: string;
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ConnectorVersion {
  id: string;
  pluginId: string;
  version: string;
  changelog?: string;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
}

export interface OrganizationConnector {
  id: string;
  organizationId: string;
  pluginId: string;
  version: string;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
}

// ─── Deployments ────────────────────────────────────────────────────────────

export type DeploymentStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK';

export interface Deployment {
  id: string;
  organizationId: string;
  environmentId: string;
  pluginId: string;
  pluginVersionId: string;
  status: DeploymentStatus;
  triggeredBy?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// ─── Feature Flags ──────────────────────────────────────────────────────────

export type FeatureFlagKind = 'BOOLEAN' | 'PERCENTAGE' | 'VARIANT';

export interface FeatureFlag {
  id: string;
  organizationId?: string;
  environmentId?: string;
  key: string;
  kind: FeatureFlagKind;
  enabled: boolean;
  rolloutPercent?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
