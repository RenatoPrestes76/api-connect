export type SetupStep =
  | 'company'
  | 'admin'
  | 'database'
  | 'connector'
  | 'secrets'
  | 'provision'
  | 'finish';

export type SessionStatus = 'active' | 'provisioning' | 'completed' | 'failed';
export type ProvisionTaskStatus = 'pending' | 'done' | 'error';
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' | 'supabase';
export type ConnectorType = 'rest' | 'soap' | 'graphql' | 'database' | 'file' | 'ftp' | 'webhook';
export type SecretsProvider = 'vault' | 'aws' | 'azure' | 'gcp' | 'internal';
export type WorkspaceEnvironment = 'production' | 'staging' | 'development';
export type SetupPlan = 'community' | 'professional' | 'enterprise';

export interface CompanyData {
  name: string;
  cnpj?: string;
  domain: string;
  plan: SetupPlan;
  timezone: string;
  locale: string;
}

export interface WorkspaceData {
  name: string;
  environment: WorkspaceEnvironment;
}

export interface AdminData {
  name: string;
  email: string;
  phone?: string;
  mfaEnabled: boolean;
}

export interface DatabaseData {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  connectionTested: boolean;
}

export interface ConnectorData {
  type: ConnectorType;
  name: string;
  baseUrl?: string;
}

export interface AgentData {
  name: string;
  type: string;
}

export interface SecretsData {
  provider: SecretsProvider;
  configured: boolean;
}

export interface ProvisionTask {
  id: string;
  label: string;
  status: ProvisionTaskStatus;
  completedAt?: string;
  error?: string;
}

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  checkedAt?: string;
}

export interface OnboardingSession {
  id: string;
  tenantId: string | null;
  workspaceId: string | null;
  agentId: string | null;
  apiKey: string | null;
  currentStep: SetupStep;
  status: SessionStatus;
  company?: CompanyData;
  workspace?: WorkspaceData;
  admin?: AdminData;
  database?: DatabaseData;
  connector?: ConnectorData;
  agent?: AgentData;
  secrets?: SecretsData;
  provisionTasks: ProvisionTask[];
  validationChecks: ValidationCheck[];
  token: string;
  expiresAt: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface OnboardingLog {
  id: string;
  sessionId: string;
  event: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface InstallationReport {
  id: string;
  sessionId: string;
  tenantId: string;
  company: string;
  durationMs: number;
  success: boolean;
  errors: string[];
  summary: {
    tenantId: string;
    workspaceId: string;
    agentId: string;
    connector: string;
    tasksTotal: number;
    tasksPassed: number;
  };
  createdAt: string;
}

export interface ProvisionResult {
  tasks: ProvisionTask[];
  tenantId: string;
  workspaceId: string;
  agentId: string;
  apiKey: string;
  validationChecks: ValidationCheck[];
}
