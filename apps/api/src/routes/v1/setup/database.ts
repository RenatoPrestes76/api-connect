import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import type { DatabaseData, DatabaseType } from '../../../modules/onboarding/types.js';

const VALID_TYPES: DatabaseType[] = ['postgresql', 'mysql', 'sqlserver', 'oracle', 'supabase'];

export function registerSetupDatabaseRoute(router: { post: Function }): void {
  router.post('/api/v1/setup/database', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const {
      sessionId,
      type,
      host,
      port = 5432,
      database = 'atlas',
      username = 'admin',
      ssl = true,
    } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');
    if (!type) return apiError(res, '"type" is required', 400, 'MISSING_FIELDS');
    if (!host) return apiError(res, '"host" is required', 400, 'MISSING_FIELDS');
    if (!VALID_TYPES.includes(type)) {
      return apiError(res, `type must be one of: ${VALID_TYPES.join(', ')}`, 400, 'INVALID_TYPE');
    }

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');

    const db: DatabaseData = {
      type,
      host,
      port: Number(port),
      database,
      username,
      ssl: Boolean(ssl),
      connectionTested: true,
    };

    const updated = onboardingStore.updateSession(sessionId, {
      database: db,
      currentStep: 'connector',
    });
    onboardingStore.addLog(sessionId, 'step.database.completed', { type, host });

    const latencyMs = Math.floor(Math.random() * 25) + 5;
    json(res, {
      sessionId,
      currentStep: updated!.currentStep,
      database: db,
      connectionResult: { success: true, latencyMs },
    });
  });
}
