import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireRuntimeAuth } from '../../../middleware/runtime-auth.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';

/** Self-service config fetch — the Runtime authenticates with its JWT session instead of signing this request individually. */
export function registerRuntimeConfigRoute(router: Router): void {
  router.get(
    '/runtime/config',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const config = runtimeRegistrationStore.getRuntimeConfig(ctx.runtimeId as string);
      if (!config) return apiError(res, 'Runtime config not found', 404, 'NOT_FOUND');
      json(res, { config });
    })
  );
}
