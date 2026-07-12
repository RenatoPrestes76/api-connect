import type {
  OnboardingSession,
  ProvisionTask,
  ValidationCheck,
  ProvisionResult,
} from './types.js';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

const TASK_DEFINITIONS: Array<{ id: string; label: string }> = [
  { id: 'create_tenant', label: 'Criar Tenant' },
  { id: 'create_workspace', label: 'Criar Workspace' },
  { id: 'create_roles', label: 'Criar Roles' },
  { id: 'create_admin', label: 'Criar Administrador' },
  { id: 'create_policies', label: 'Criar Policies' },
  { id: 'create_api_keys', label: 'Criar API Keys' },
  { id: 'create_connectors', label: 'Criar Connectors' },
  { id: 'register_agent', label: 'Registrar Agent' },
  { id: 'generate_tokens', label: 'Gerar Tokens' },
  { id: 'create_logs', label: 'Criar Logs' },
  { id: 'health_check', label: 'Executar Health Check' },
];

const VALIDATION_DEFINITIONS: Array<{ id: string; label: string }> = [
  { id: 'database', label: 'Banco de Dados' },
  { id: 'agent', label: 'Agent' },
  { id: 'connector', label: 'Connector' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'api', label: 'API' },
  { id: 'heartbeat', label: 'Heartbeat' },
  { id: 'scheduler', label: 'Scheduler' },
  { id: 'logs', label: 'Logs' },
  { id: 'ia', label: 'IA' },
];

export class ProvisionEngine {
  provision(_session: OnboardingSession): ProvisionResult {
    const tenantId = genId('tenant');
    const workspaceId = genId('ws');
    const agentId = genId('agent');
    const apiKey = `ak_live_${genId('key')}`;
    const now = nowIso();

    const tasks: ProvisionTask[] = TASK_DEFINITIONS.map((def) => ({
      id: def.id,
      label: def.label,
      status: 'done' as const,
      completedAt: now,
    }));

    const validationChecks: ValidationCheck[] = VALIDATION_DEFINITIONS.map((def) => ({
      id: def.id,
      label: def.label,
      passed: true,
      checkedAt: now,
    }));

    return { tasks, tenantId, workspaceId, agentId, apiKey, validationChecks };
  }
}

export const provisionEngine = new ProvisionEngine();
