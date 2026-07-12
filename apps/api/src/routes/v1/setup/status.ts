import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';

export function registerSetupStatusRoute(router: { get: Function }): void {
  router.get('/api/v1/setup/status', (ctx: RouteContext, res: ServerResponse) => {
    const sessionId = ctx.query.get('sessionId');
    if (!sessionId) {
      return apiError(res, '"sessionId" query param is required', 400, 'MISSING_FIELDS');
    }

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');

    const logs = onboardingStore.getLogs(sessionId);

    json(res, {
      sessionId,
      currentStep: session.currentStep,
      status: session.status,
      stepsCompleted: {
        company: Boolean(session.company),
        admin: Boolean(session.admin),
        database: Boolean(session.database),
        connector: Boolean(session.connector),
        secrets: Boolean(session.secrets),
        provision: session.provisionTasks.length > 0,
      },
      provisionTasks: session.provisionTasks,
      validationChecks: session.validationChecks,
      company: session.company,
      admin: session.admin,
      tenantId: session.tenantId,
      workspaceId: session.workspaceId,
      agentId: session.agentId,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      logsCount: logs.length,
    });
  });
}
