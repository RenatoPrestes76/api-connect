import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { governanceStore } from '../../../modules/governance/governance-store.js';

const VALID_FORMATS = ['json', 'csv', 'pdf'];

export function registerAuditRoutes(router: Router): void {
  // GET /api/v1/audit/logs
  router.get('/api/v1/audit/logs', async (ctx: RouteContext, res: ServerResponse) => {
    const actor = ctx.query.get('actor') ?? undefined;
    const action = ctx.query.get('action') ?? undefined;
    const tenantId = ctx.query.get('tenantId') ?? undefined;
    const limitStr = ctx.query.get('limit');
    const limit = limitStr ? Math.min(Number(limitStr), 500) : undefined;

    const logs = governanceStore.getLogs({ actor, action, tenantId, limit });
    json(res, { total: logs.length, logs });
  });

  // GET /api/v1/audit/export
  router.get('/api/v1/audit/export', async (ctx: RouteContext, res: ServerResponse) => {
    const format = ctx.query.get('format') ?? 'json';
    const limitStr = ctx.query.get('limit');
    const limit = limitStr ? Math.min(Number(limitStr), 10_000) : undefined;

    if (!VALID_FORMATS.includes(format)) {
      return apiError(
        res,
        `Invalid format "${format}". Allowed: ${VALID_FORMATS.join(', ')}`,
        400,
        'INVALID_FORMAT'
      );
    }

    const result = governanceStore.exportLogs(format, { limit });
    json(res, result);
  });
}
