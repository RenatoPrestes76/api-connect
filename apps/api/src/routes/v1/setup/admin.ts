import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import type { AdminData } from '../../../modules/onboarding/types.js';

export function registerSetupAdminRoute(router: { post: Function }): void {
  router.post('/api/v1/setup/admin', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { sessionId, name, email, phone, mfaEnabled = false, password } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');
    if (!name) return apiError(res, '"name" is required', 400, 'MISSING_FIELDS');
    if (!email) return apiError(res, '"email" is required', 400, 'MISSING_FIELDS');
    if (!password) return apiError(res, '"password" is required', 400, 'MISSING_FIELDS');

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');

    // password is validated but never stored or returned
    const admin: AdminData = {
      name,
      email,
      mfaEnabled: Boolean(mfaEnabled),
      ...(phone ? { phone } : {}),
    };

    const updated = onboardingStore.updateSession(sessionId, { admin, currentStep: 'database' });
    onboardingStore.addLog(sessionId, 'step.admin.completed', { name, email });

    json(res, { sessionId, currentStep: updated!.currentStep, admin });
  });
}
