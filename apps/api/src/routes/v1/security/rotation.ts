import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { secretRotationScheduler } from '../../../modules/security/secret-rotation.js';

export function registerSecretRotationRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/security/secrets/rotation/history
  router.get(
    '/api/v1/security/secrets/rotation/history',
    async (ctx: RouteContext, res: ServerResponse) => {
      const secretId = ctx.query.get('secretId') ?? undefined;
      const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);
      const history = secretRotationScheduler.getHistory(secretId, limit);
      json(res, { history, total: history.length });
    }
  );

  // POST /api/v1/security/secrets/rotation/evaluate — runs the scheduler's due-check now.
  router.post(
    '/api/v1/security/secrets/rotation/evaluate',
    async (_ctx: RouteContext, res: ServerResponse) => {
      const rotated = await secretRotationScheduler.evaluateAll();
      json(res, { rotated, total: rotated.length });
    }
  );

  // POST /api/v1/security/secrets/:id/rotate-now — force-rotates one secret regardless of due date.
  router.post(
    '/api/v1/security/secrets/:id/rotate-now',
    async (ctx: RouteContext, res: ServerResponse) => {
      const result = await secretRotationScheduler.rotateNow(ctx.params['id']!);
      if (!result) return apiError(res, 'Secret not found', 404);
      json(res, result);
    }
  );
}
