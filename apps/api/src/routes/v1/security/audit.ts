import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { verifyChain, toSiemRecord } from '@seltriva/aegis';

export function registerAuditRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/security/audit
  router.get('/api/v1/security/audit', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const limit = parseInt(ctx.query.get('limit') || '50', 10);
    const offset = parseInt(ctx.query.get('offset') || '0', 10);
    const action = ctx.query.get('action');
    let entries = securityStore.getAuditEntries(tenantId, limit + offset, 0);
    if (action) entries = entries.filter((e) => e.event.action === action);
    json(res, {
      entries: entries.slice(offset, offset + limit),
      total: entries.length,
      limit,
      offset,
    });
  });

  // GET /api/v1/security/audit/verify — must register BEFORE /:id would conflict
  router.get('/api/v1/security/audit/verify', async (_ctx: RouteContext, res: ServerResponse) => {
    const chain = securityStore.getAuditChain();
    const result = verifyChain(chain);
    json(res, result);
  });

  // POST /api/v1/security/audit/export
  router.post('/api/v1/security/audit/export', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const entries = securityStore.getAuditEntries(tenantId, 1000, 0);
    const siemRecords = entries.map(toSiemRecord);
    json(res, { format: 'ecs', records: siemRecords, total: siemRecords.length });
  });
}
