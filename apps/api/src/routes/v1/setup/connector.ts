import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { onboardingStore } from '../../../modules/onboarding/onboarding-store.js';
import type { ConnectorData, ConnectorType } from '../../../modules/onboarding/types.js';

const VALID_TYPES: ConnectorType[] = [
  'rest',
  'soap',
  'graphql',
  'database',
  'file',
  'ftp',
  'webhook',
];

export function registerSetupConnectorRoute(router: { post: Function }): void {
  router.post('/api/v1/setup/connector', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { sessionId, type, name, baseUrl } = body;

    if (!sessionId) return apiError(res, '"sessionId" is required', 400, 'MISSING_FIELDS');
    if (!type) return apiError(res, '"type" is required', 400, 'MISSING_FIELDS');
    if (!name) return apiError(res, '"name" is required', 400, 'MISSING_FIELDS');
    if (!VALID_TYPES.includes(type)) {
      return apiError(res, `type must be one of: ${VALID_TYPES.join(', ')}`, 400, 'INVALID_TYPE');
    }

    const session = onboardingStore.getSession(sessionId);
    if (!session) return apiError(res, 'Session not found', 404, 'NOT_FOUND');

    const connector: ConnectorData = { type, name, ...(baseUrl ? { baseUrl } : {}) };
    const updated = onboardingStore.updateSession(sessionId, {
      connector,
      currentStep: 'secrets',
    });
    onboardingStore.addLog(sessionId, 'step.connector.completed', { type, name });

    json(res, { sessionId, currentStep: updated!.currentStep, connector });
  });
}
