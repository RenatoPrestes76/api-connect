import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';

export function registerSetupStartRoute(router: { post: Function }): void {
  router.post('/api/v1/setup/start', (_ctx: RouteContext, res: ServerResponse) => {
    const session = onboardingStore.createSession();
    json(
      res,
      {
        sessionId: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
        currentStep: session.currentStep,
      },
      201
    );
  });
}
