export type SetupStep =
  | 'company'
  | 'admin'
  | 'database'
  | 'connector'
  | 'agent'
  | 'secrets'
  | 'provision'
  | 'finish';

export type SessionStatus = 'active' | 'provisioning' | 'completed' | 'failed';
export type ProvisionTaskStatus = 'pending' | 'done' | 'error';
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' | 'supabase';
export type ConnectorType = 'rest' | 'soap' | 'graphql' | 'database' | 'file' | 'ftp' | 'webhook';
export type SecretsProvider = 'vault' | 'aws' | 'azure' | 'gcp' | 'internal';
export type SetupPlan = 'community' | 'professional' | 'enterprise';
export type WorkspaceEnvironment = 'production' | 'staging' | 'development';

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ProvisionTask {
  id: string;
  label: string;
  status: ProvisionTaskStatus;
  completedAt?: string;
}

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  checkedAt?: string;
}

export interface StartResponse {
  sessionId: string;
  token: string;
  expiresAt: string;
  currentStep: string;
}

export interface ProvisionResponse {
  sessionId: string;
  tasks: ProvisionTask[];
  validationChecks: ValidationCheck[];
  tenantId: string;
  workspaceId: string;
  agentId: string;
  apiKey: string;
}

export interface FinishSummary {
  tenantId: string;
  workspaceId: string;
  agentId: string;
  company: string;
  workspace: string;
  connector: string;
  apiKey: string;
  durationMs: number;
}

export interface FinishResponse {
  success: boolean;
  report: {
    id: string;
    durationMs: number;
    success: boolean;
    summary: {
      tasksTotal: number;
      tasksPassed: number;
    };
  };
  summary: FinishSummary;
}

// ─── Form data shapes ─────────────────────────────────────────────────────────

export interface CompanyFormData {
  name: string;
  cnpj: string;
  domain: string;
  plan: SetupPlan;
  timezone: string;
  locale: string;
  workspaceName: string;
  workspaceEnvironment: WorkspaceEnvironment;
}

export interface AdminFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  mfaEnabled: boolean;
}

export interface DatabaseFormData {
  type: DatabaseType;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface ConnectorFormData {
  type: ConnectorType;
  name: string;
  baseUrl: string;
}

export interface AgentFormData {
  name: string;
  type: string;
}

export interface SecretsFormData {
  provider: SecretsProvider;
}

// ─── Wizard state ─────────────────────────────────────────────────────────────

export interface WizardState {
  sessionId: string | null;
  step: SetupStep;
  loading: boolean;
  error: string | null;
  company: CompanyFormData | null;
  admin: AdminFormData | null;
  database: DatabaseFormData | null;
  connector: ConnectorFormData | null;
  agent: AgentFormData | null;
  secrets: SecretsFormData | null;
  provisionResult: ProvisionResponse | null;
  finishResult: FinishResponse | null;
}
