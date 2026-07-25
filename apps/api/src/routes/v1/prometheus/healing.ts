import type { ServerResponse } from 'http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';

export function registerHealingRoutes(router: Router): void {
  router.get('/api/v1/prometheus/self-healing', async (_ctx: RouteContext, res: ServerResponse) => {
    const rules = prometheusStore.getSelfHealingRules();
    json(res, {
      rules,
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
    });
  });

  router.post(
    '/api/v1/prometheus/self-healing/:id/toggle',
    async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const rule = prometheusStore.toggleSelfHealingRule(id);
      if (!rule) return apiError(res, 'Self-healing rule not found', 404, 'RULE_NOT_FOUND');
      json(res, rule);
    }
  );
}
