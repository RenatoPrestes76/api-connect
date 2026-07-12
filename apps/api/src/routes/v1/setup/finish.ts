import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import type { InstallationReport } from '../../../modules/onboarding/types.js';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function registerSetupFinishRoute(router: { post: Function }): void {
  router.post('/api/v1/setup/finish', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { sessionId } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');
    if (session.provisionTasks.length === 0) {
      return apiError(res, 'Provision step not completed', 400, 'PROVISION_REQUIRED');
    }

    const durationMs = Date.now() - new Date(session.startedAt).getTime();
    const tasksPassed = session.provisionTasks.filter((t) => t.status === 'done').length;

    const report: InstallationReport = {
      id: genId('rpt'),
      sessionId,
      tenantId: session.tenantId ?? '',
      company: session.company?.name ?? '',
      durationMs,
      success: session.status === 'completed',
      errors: [],
      summary: {
        tenantId: session.tenantId ?? '',
        workspaceId: session.workspaceId ?? '',
        agentId: session.agentId ?? '',
        connector: session.connector?.name ?? '',
        tasksTotal: session.provisionTasks.length,
        tasksPassed,
      },
      createdAt: new Date().toISOString(),
    };

    onboardingStore.saveReport(report);
    onboardingStore.addLog(sessionId, 'setup.finished', {
      durationMs,
      success: report.success,
    });

    json(res, {
      success: true,
      report,
      summary: {
        tenantId: session.tenantId,
        workspaceId: session.workspaceId,
        agentId: session.agentId,
        company: session.company?.name,
        workspace: session.workspace?.name,
        connector: session.connector?.name,
        apiKey: session.apiKey,
        durationMs,
      },
    });
  });
}
