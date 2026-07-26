import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import type {
  CompanyData,
  WorkspaceData,
  SetupPlan,
  WorkspaceEnvironment,
} from '../../../modules/onboarding/types.js';

const VALID_PLANS: SetupPlan[] = ['community', 'professional', 'enterprise'];
const VALID_ENVS: WorkspaceEnvironment[] = ['production', 'staging', 'development'];

interface SetupCompanyBody {
  sessionId?: string;
  name?: string;
  domain?: string;
  cnpj?: string;
  plan?: SetupPlan;
  timezone?: string;
  locale?: string;
  workspace?: { name?: string; environment?: string };
}

export function registerSetupCompanyRoute(router: Router): void {
  router.post('/api/v1/setup/company', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as SetupCompanyBody | undefined) ?? {};
    const {
      sessionId,
      name,
      domain,
      cnpj,
      plan = 'professional',
      timezone = 'America/Sao_Paulo',
      locale = 'pt-BR',
      workspace,
    } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');
    if (!name) return apiError(res, '"name" is required', 400, 'MISSING_FIELDS');
    if (!domain) return apiError(res, '"domain" is required', 400, 'MISSING_FIELDS');
    if (!VALID_PLANS.includes(plan)) {
      return apiError(res, `plan must be one of: ${VALID_PLANS.join(', ')}`, 400, 'INVALID_PLAN');
    }

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');
    if (session.status === 'completed') {
      return apiError(res, 'Session already completed', 400, 'SESSION_COMPLETED');
    }

    const company: CompanyData = {
      name,
      domain,
      plan,
      timezone,
      locale,
      ...(cnpj ? { cnpj } : {}),
    };

    const wsInput = workspace ?? {};
    const wsEnv: WorkspaceEnvironment = VALID_ENVS.includes(
      wsInput.environment as WorkspaceEnvironment
    )
      ? (wsInput.environment as WorkspaceEnvironment)
      : 'production';
    const ws: WorkspaceData = { name: wsInput.name || name, environment: wsEnv };

    const updated = onboardingStore.updateSession(sessionId, {
      company,
      workspace: ws,
      currentStep: 'admin',
    });
    if (!updated) return apiError(res, 'Session not found', 404, 'NOT_FOUND');
    onboardingStore.addLog(sessionId, 'step.company.completed', { name, domain, plan });

    json(res, { sessionId, currentStep: updated.currentStep, company, workspace: ws });
  });
}
