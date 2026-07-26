import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import type { SecretsData, SecretsProvider } from '../../../modules/onboarding/types.js';

const VALID_PROVIDERS: SecretsProvider[] = ['vault', 'aws', 'azure', 'gcp', 'internal'];

interface SetupSecretsBody {
  sessionId?: string;
  provider?: string;
}

export function registerSetupSecretsRoute(router: Router): void {
  router.post('/api/v1/setup/secrets', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as SetupSecretsBody | undefined) ?? {};
    const { sessionId, provider } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');
    if (!provider) return apiError(res, '"provider" is required', 400, 'MISSING_FIELDS');
    if (!VALID_PROVIDERS.includes(provider as SecretsProvider)) {
      return apiError(
        res,
        `provider must be one of: ${VALID_PROVIDERS.join(', ')}`,
        400,
        'INVALID_PROVIDER'
      );
    }

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');

    const secrets: SecretsData = { provider: provider as SecretsProvider, configured: true };
    const updated = onboardingStore.updateSession(sessionId, {
      secrets,
      currentStep: 'provision',
    });
    if (!updated) return apiError(res, 'Session not found', 404, 'NOT_FOUND');
    onboardingStore.addLog(sessionId, 'step.secrets.completed', { provider });

    json(res, { sessionId, currentStep: updated.currentStep, secrets });
  });
}
