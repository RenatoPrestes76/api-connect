export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CHURNED';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  primaryContactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationTier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'DELETED';

export interface Organization {
  id: string;
  tenantId?: string;
  slug: string;
  name: string;
  tier: OrganizationTier;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

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
}

export type EnvironmentKind = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type EnvironmentStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

export interface Environment {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  kind: EnvironmentKind;
  status: EnvironmentStatus;
  createdAt: string;
}

export type RuntimeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNRESPONSIVE' | 'RETIRED';

export interface Runtime {
  id: string;
  organizationId: string;
  environmentId: string;
  name: string;
  version: string;
  status: RuntimeStatus;
  lastSeenAt?: string;
  registeredAt: string;
  hostname?: string;
  platform?: string;
  createdAt: string;
}

export type ConnectorStatus = 'PUBLISHED' | 'DRAFT' | 'DEPRECATED' | 'ARCHIVED';

export interface Connector {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  status: ConnectorStatus;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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
}

export type DeploymentStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK';

export interface Deployment {
  id: string;
  organizationId: string;
  environmentId: string;
  pluginId: string;
  pluginVersionId: string;
  status: DeploymentStatus;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

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

export interface DashboardSummary {
  tenants: number;
  organizations: number;
  environments: number;
  runtimesOnline: number;
  runtimesTotal: number;
  connectorsPublished: number;
  deploymentsInProgress: number;
  activeFeatureFlags: number;
}
