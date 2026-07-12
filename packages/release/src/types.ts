// ─── Release Stages ───────────────────────────────────────────────────────────
export type ReleaseStage = 'beta' | 'rc1' | 'rc2' | 'rc3' | 'ga';

// ─── Checklist ────────────────────────────────────────────────────────────────
export type ChecklistCategory =
  | 'produto'
  | 'infra'
  | 'comercial'
  | 'suporte'
  | 'seguranca'
  | 'performance';

export type ChecklistStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  label: string;
  status: ChecklistStatus;
  blocksRelease: boolean;
  notes: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
}

export interface ChecklistSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  blockers: number;
  readyForRelease: boolean;
  byCategory: Record<ChecklistCategory, { total: number; passed: number }>;
}

export interface ChecklistResult extends ChecklistSummary {
  items: ChecklistItem[];
}

// ─── Version Management ───────────────────────────────────────────────────────
export interface ReleaseVersion {
  version: string;
  stage: ReleaseStage;
  buildNumber: number;
  gitSha: string;
  releasedAt: string | null;
  certifiedAt: string | null;
  certifiedBy: string | null;
  notes: string | null;
}

// ─── Changelog ────────────────────────────────────────────────────────────────
export type ChangeType = 'feat' | 'fix' | 'perf' | 'security' | 'breaking' | 'docs' | 'infra';

export interface ChangeEntry {
  id: string;
  type: ChangeType;
  description: string;
  sprint: number;
  component: string;
}

export interface ChangelogVersion {
  version: string;
  releasedAt: string;
  sprint: number;
  codename: string;
  summary: string;
  entries: ChangeEntry[];
}

// ─── SBOM ─────────────────────────────────────────────────────────────────────
export type SBOMComponentType = 'runtime' | 'dev' | 'transitive';

export interface SBOMComponent {
  name: string;
  version: string;
  license: string;
  type: SBOMComponentType;
  purl: string;
  vulnerabilities: number;
}

export interface SBOM {
  version: string;
  generatedAt: string;
  format: 'spdx-json';
  components: SBOMComponent[];
  totalComponents: number;
  totalVulnerabilities: number;
  licenses: string[];
}

// ─── Go-Live Metrics ──────────────────────────────────────────────────────────
export type MetricStatus = 'met' | 'not_met' | 'unknown';
export type MetricOperator = 'gte' | 'lte' | 'eq';

export interface GoLiveMetric {
  name: string;
  key: string;
  value: number;
  unit: string;
  target: number;
  targetOperator: MetricOperator;
  status: MetricStatus;
  description: string;
}

export interface GoLiveSnapshot {
  snapshotAt: string;
  mrr: number;
  arr: number;
  tenants: number;
  agents: number;
  workflowsActive: number;
  connectorsInstalled: number;
  apiCallsPerDay: number;
  aiCreditsUsed: number;
  marketplaceInstalls: number;
  nps: number;
  metrics: GoLiveMetric[];
}

// ─── Support ──────────────────────────────────────────────────────────────────
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

// ─── API Keys ─────────────────────────────────────────────────────────────────
export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  active: boolean;
  createdBy: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
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

// ─── Portal Dashboard ─────────────────────────────────────────────────────────
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
}

// ─── Portal Connector Status ──────────────────────────────────────────────────
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

// ─── Portal User ──────────────────────────────────────────────────────────────
export type UserRole = 'owner' | 'admin' | 'developer' | 'viewer';

export interface PortalUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  invitedAt: string;
  status: 'active' | 'invited' | 'suspended';
}
