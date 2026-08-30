import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
import { billingStore } from '../../../modules/billing/billing-store.js';

// GET /api/v1/billing/invoices
export async function listInvoices(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireOrgId(ctx);
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

/**
 * GET /api/v1/billing/invoices/:id — ATLAS 46.26: previously took only the
 * `id` from the URL with no tenant check at all (billingStore.getInvoiceById
 * had no tenant parameter to check against) — any authenticated caller
 * could read any other tenant's invoice by guessing/enumerating its id.
 * Fixed to require the same session-derived org and verify the invoice
 * actually belongs to it before returning it — a 404 either way (unknown
 * id or someone else's invoice), so the response never distinguishes
 * "doesn't exist" from "exists but isn't yours".
 */
export async function getInvoice(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireOrgId(ctx);
  const id = ctx.params['id'];
  const inv = billingStore.getInvoiceById(id);
  if (!inv || inv.tenantId !== tenantId) {
    apiError(res, 'Invoice not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, inv);
}
