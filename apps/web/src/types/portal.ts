export type SupportSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportCategory = 'billing' | 'technical' | 'security' | 'integration' | 'other';

export interface SupportTicket {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  severity: SupportSeverity;
  status: SupportStatus;
  category: SupportCategory;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  slaTargetHours: number;
}

export type OnboardingStep =
  | 'cadastro'
  | 'provisionamento'
  | 'conector'
  | 'primeiro_workflow'
  | 'primeira_execucao'
  | 'producao';

export interface OnboardingProgress {
  tenantId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  startedAt: string;
  completedAt: string | null;
  percentComplete: number;
}

export interface PortalDashboard {
  tenantId: string;
  plan: string;
  agentsOnline: number;
  agentsTotal: number;
  workflowsActive: number;
  connectorsInstalled: number;
  apiCallsToday: number;
  aiCreditsUsed: number;
  aiCreditsTotal: number;
  nextBillingDate: string;
  openTickets: number;
  healthScore: number;
  onboarding: OnboardingProgress;
  /** Sprint 46.4 — organization/environments/users summary cards. */
  organizationSummary: {
    organizations: number;
    users: number;
    environments: number;
    apisRegistered: number;
    connectors: number;
  };
}

export type ConnectorHealth = 'healthy' | 'degraded' | 'error' | 'unknown';

export interface PortalConnector {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  version: string;
  health: ConnectorHealth;
  lastSyncAt: string | null;
  errorCount: number;
  syncCount: number;
  installedAt: string;
}

// ─── Organization identity (Sprint 46.4) ───────────────────────────────────
//
// Deliberately a separate role enum from `UserRole` in @seltriva/release
// (which only has 4 roles, no Operator) — see the Sprint 46.4 plan for why
// this isn't a shared-package change.

export type OrgRole = 'OWNER' | 'ADMINISTRATOR' | 'DEVELOPER' | 'OPERATOR' | 'VIEWER';

export type OrganizationStatus = 'active' | 'suspended' | 'deleted';
export type OrganizationPlan = 'community' | 'professional' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  razaoSocial: string;
  cnpj: string;
  internalCode: string;
  status: OrganizationStatus;
  plan: OrganizationPlan;
  createdAt: string;
  updatedAt: string;
}

export type EnvironmentKind = 'production' | 'staging' | 'development';
export type EnvironmentStatus = 'active' | 'inactive';

export interface Environment {
  id: string;
  organizationId: string;
  name: string;
  kind: EnvironmentKind;
  status: EnvironmentStatus;
  region: string;
  timezone: string;
  createdAt: string;
}

export type OrgUserStatus = 'invited' | 'active' | 'suspended';

export interface OrgInvite {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: OrgRole;
  expiresAt: string;
  acceptedAt?: string;
  invitedBy: string;
  createdAt: string;
}

export interface OrgAuditEntry {
  id: string;
  organizationId: string;
  action: string;
  actorId?: string;
  actorEmail: string;
  target?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PortalUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: OrgRole;
  status: OrgUserStatus;
  invitedAt: string;
  joinedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Connector catalog (Sprint 46.6, read-only browse) ───────────────────────

export type ConnectorCatalogCategory =
  | 'DATABASE'
  | 'ERP'
  | 'REST_API'
  | 'SOAP'
  | 'FTP_SFTP'
  | 'MESSAGING'
  | 'FILES'
  | 'WEBHOOK'
  | 'CUSTOM';

export interface ConnectorCatalogEntry {
  id: string;
  identifier: string;
  name: string;
  category: ConnectorCatalogCategory;
  vendor: string;
  description: string;
  icon?: string;
  currentVersion: string | null;
  status: 'active' | 'beta' | 'deprecated';
  minRuntimeVersion: string;
  createdAt: string;
  updatedAt: string;
}

export type ConnectorCatalogParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'secret'
  | 'enum'
  | 'url';

export interface ConnectorCatalogParameter {
  id: string;
  connectorId: string;
  key: string;
  label: string;
  type: ConnectorCatalogParameterType;
  required: boolean;
  defaultValue?: string | number | boolean;
  validationPattern?: string;
  options?: string[];
  sensitive: boolean;
  description?: string;
  order: number;
  requiredIf?: { key: string; equals: string | number | boolean };
}

export interface ConnectorCatalogTemplate {
  id: string;
  connectorId: string;
  name: string;
  description?: string;
  values: Record<string, string | number | boolean>;
  secretKeys: string[];
}

export interface ConnectorCatalogDetail {
  connector: ConnectorCatalogEntry;
  parameters: ConnectorCatalogParameter[];
  templates: ConnectorCatalogTemplate[];
}
