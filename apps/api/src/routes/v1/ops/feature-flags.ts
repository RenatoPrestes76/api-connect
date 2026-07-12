import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { titanStore } from '../../../modules/titan/titan-store.js';
import { evaluateFlag } from '@seltriva/titan';
import type { FeatureFlag, FlagEvaluationContext } from '@seltriva/titan';

function uid(): string {
  return `ff-${Math.random().toString(36).slice(2, 10)}`;
}

export function registerFeatureFlagsRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  // GET /api/v1/ops/feature-flags — list all flags
  router.get('/api/v1/ops/feature-flags', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, { flags: titanStore.listFlags(), total: titanStore.listFlags().length });
  });

  // POST /api/v1/ops/feature-flags/:id/evaluate — must register BEFORE /:id
  router.post(
    '/api/v1/ops/feature-flags/:id/evaluate',
    (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params['id']!;
      const flag = titanStore.getFlag(id) ?? titanStore.getFlagByKey(id);
      if (!flag) return apiError(res, 'Feature flag not found', 404, 'FLAG_NOT_FOUND');
      const evalCtx = ((ctx.body as any)?.['context'] ?? {}) as FlagEvaluationContext;
      const result = evaluateFlag(flag, evalCtx);
      json(res, result);
    }
  );

  // GET /api/v1/ops/feature-flags/:id
  router.get('/api/v1/ops/feature-flags/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params['id']!;
    const flag = titanStore.getFlag(id) ?? titanStore.getFlagByKey(id);
    if (!flag) return apiError(res, 'Feature flag not found', 404, 'FLAG_NOT_FOUND');
    json(res, flag);
  });

  // POST /api/v1/ops/feature-flags — create a new flag
  router.post('/api/v1/ops/feature-flags', (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as Partial<FeatureFlag> | null;
    if (!body?.key || !body?.name) {
      return apiError(res, '"name" and "key" are required', 400, 'MISSING_FIELDS');
    }
    const now = new Date().toISOString();
    const flag: FeatureFlag = {
      id: uid(),
      name: body.name,
      key: body.key,
      description: body.description ?? '',
      enabled: body.enabled ?? false,
      rolloutPercentage: body.rolloutPercentage ?? 0,
      targetingRules: body.targetingRules ?? [],
      variants: body.variants ?? [],
      defaultVariant: body.defaultVariant ?? 'control',
      createdAt: now,
      updatedAt: now,
      createdBy: (ctx.headers['x-user-id'] as string) || 'api',
    };
    titanStore.upsertFlag(flag);
    json(res, flag, 201);
  });

  // PUT /api/v1/ops/feature-flags/:id — full update
  router.put('/api/v1/ops/feature-flags/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params['id']!;
    const body = ctx.body as Partial<FeatureFlag> | null;
    const updated = titanStore.patchFlag(id, body ?? {});
    if (!updated) return apiError(res, 'Feature flag not found', 404, 'FLAG_NOT_FOUND');
    json(res, updated);
  });

  // DELETE /api/v1/ops/feature-flags/:id
  router.delete('/api/v1/ops/feature-flags/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params['id']!;
    const deleted = titanStore.deleteFlag(id);
    if (!deleted) return apiError(res, 'Feature flag not found', 404, 'FLAG_NOT_FOUND');
    json(res, { deleted: true });
  });
}
