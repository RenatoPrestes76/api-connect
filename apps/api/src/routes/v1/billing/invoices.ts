import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { billingStore } from '../../../modules/billing/billing-store.js';

// GET /api/v1/billing/invoices
export async function listInvoices(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  const statusFilter = ctx.query.get('status') ?? '';
  const limitStr = ctx.query.get('limit') ?? '20';
  const offsetStr = ctx.query.get('offset') ?? '0';
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 20));
  const offset = Math.max(0, parseInt(offsetStr, 10) || 0);

  let invoices = billingStore.getInvoices(tenantId);
  if (statusFilter) {
    invoices = invoices.filter((i) => i.status === statusFilter);
  }
  invoices = invoices.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const total = invoices.length;
  const page = invoices.slice(offset, offset + limit);
  json(res, { total, offset, limit, items: page });
}

// GET /api/v1/billing/invoices/:id
export async function getInvoice(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const id = ctx.params['id'];
  const inv = billingStore.getInvoiceById(id);
  if (!inv) {
    apiError(res, 'Invoice not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, inv);
}
