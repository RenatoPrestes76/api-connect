import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import type { SecretsData, SecretsProvider } from '../../../modules/onboarding/types.js';

const VALID_PROVIDERS: SecretsProvider[] = ['vault', 'aws', 'azure', 'gcp', 'internal'];

export function registerSetupSecretsRoute(router: { post: Function }): void {
  router.post('/api/v1/setup/secrets', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { sessionId, provider } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');
    if (!provider) return apiError(res, '"provider" is required', 400, 'MISSING_FIELDS');
    if (!VALID_PROVIDERS.includes(provider)) {
      return apiError(
        res,
        `provider must be one of: ${VALID_PROVIDERS.join(', ')}`,
        400,
        'INVALID_PROVIDER'
      );
    }

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');

    const secrets: SecretsData = { provider, configured: true };
    const updated = onboardingStore.updateSession(sessionId, {
      secrets,
      currentStep: 'provision',
    });
    onboardingStore.addLog(sessionId, 'step.secrets.completed', { provider });

    json(res, { sessionId, currentStep: updated!.currentStep, secrets });
  });
}
