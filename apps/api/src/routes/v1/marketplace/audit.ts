import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { marketplaceStore } from '../../../modules/marketplace/marketplace-store.js';

// GET /api/v1/marketplace/audit
export async function listMarketplaceAudit(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const connectorId = ctx.query.get('connectorId') ?? '';
  const action = ctx.query.get('action') ?? '';
  const limitStr = ctx.query.get('limit') ?? '50';
  const offsetStr = ctx.query.get('offset') ?? '0';
  const limit = Math.min(200, Math.max(1, parseInt(limitStr, 10) || 50));
  const offset = Math.max(0, parseInt(offsetStr, 10) || 0);

  let logs = [...marketplaceStore.auditLogs];
  if (connectorId) logs = logs.filter((l) => l.connectorId === connectorId);
  if (action) logs = logs.filter((l) => l.action === action);

  const page = logs.slice(offset, offset + limit);
  json(res, { total: logs.length, offset, limit, items: page });
}
