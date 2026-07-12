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
  key?: string;
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
