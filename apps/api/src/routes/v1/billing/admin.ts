import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { billingStore } from '../../../modules/billing/billing-store.js';

// GET /api/v1/billing/admin/dashboard
export async function getAdminDashboard(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const metrics = billingStore.computeMetrics();
  json(res, metrics);
}

// GET /api/v1/billing/admin/subscriptions
export async function listAllSubscriptions(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const subs = [...billingStore.subscriptions.values()];
  json(res, { total: subs.length, items: subs });
}

// GET /api/v1/billing/admin/invoices
export async function listAllInvoices(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const statusFilter = ctx.query.get('status') ?? '';
  let invoices = billingStore.invoices;
  if (statusFilter) {
    invoices = invoices.filter((i) => i.status === statusFilter);
  }
  invoices = [...invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  json(res, { total: invoices.length, items: invoices });
}
