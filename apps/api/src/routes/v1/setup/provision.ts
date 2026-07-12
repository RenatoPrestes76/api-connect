import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import { provisionEngine } from '../../../modules/onboarding/provision-engine.js';
import type { AgentData } from '../../../modules/onboarding/types.js';

export function registerSetupProvisionRoute(router: { post: Function }): void {
  router.post('/api/v1/setup/provision', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { sessionId, agentName, agentType = 'connector' } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');
    if (!session.company) {
      return apiError(res, 'Company step not completed', 400, 'STEP_INCOMPLETE');
    }
    if (!session.admin) {
      return apiError(res, 'Admin step not completed', 400, 'STEP_INCOMPLETE');
    }
    if (!session.database) {
      return apiError(res, 'Database step not completed', 400, 'STEP_INCOMPLETE');
    }

    // Idempotent — return cached result if already provisioned
    if (session.status === 'completed' && session.provisionTasks.length > 0) {
      json(res, {
        sessionId,
        tasks: session.provisionTasks,
        validationChecks: session.validationChecks,
        tenantId: session.tenantId,
        workspaceId: session.workspaceId,
        agentId: session.agentId,
        apiKey: session.apiKey,
      });
      return;
    }

    const agent: AgentData = {
      name: agentName || 'atlas-agent-01',
      type: agentType,
    };
    onboardingStore.updateSession(sessionId, { agent, status: 'provisioning' });

    const result = provisionEngine.provision({ ...session, agent });

    onboardingStore.updateSession(sessionId, {
      tenantId: result.tenantId,
      workspaceId: result.workspaceId,
      agentId: result.agentId,
      apiKey: result.apiKey,
      provisionTasks: result.tasks,
      validationChecks: result.validationChecks,
      status: 'completed',
      currentStep: 'finish',
      completedAt: new Date().toISOString(),
    });
    onboardingStore.addLog(sessionId, 'provision.completed', {
      tenantId: result.tenantId,
      tasksTotal: result.tasks.length,
      checksTotal: result.validationChecks.length,
    });

    json(res, {
      sessionId,
      tasks: result.tasks,
      validationChecks: result.validationChecks,
      tenantId: result.tenantId,
      workspaceId: result.workspaceId,
      agentId: result.agentId,
      apiKey: result.apiKey,
    });
  });
}
