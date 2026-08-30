import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { billingStore } from '../../../modules/billing/billing-store.js';

/**
 * ATLAS 46.26 — these three routes return every tenant's revenue/
 * subscription/invoice data (MRR, ARR, all customers) and previously had
 * no permission check at all — reachable by any caller holding nothing
 * more than a valid Supabase session, not specifically staff. Gated here
 * behind the existing `billing.manage` permission (already defined in
 * admin-identity's catalog and already granted to the COMERCIAL role) —
 * the same requirePermission mechanism every other admin-only surface in
 * this codebase already uses, not a new authorization scheme.
 */

// GET /api/v1/billing/admin/dashboard
export const getAdminDashboard = requirePermission('billing.manage')(async (
  _ctx: RouteContext,
  res: ServerResponse
): Promise<void> => {
  const metrics = billingStore.computeMetrics();
  json(res, metrics);
});

// GET /api/v1/billing/admin/subscriptions
export const listAllSubscriptions = requirePermission('billing.manage')(async (
  _ctx: RouteContext,
  res: ServerResponse
): Promise<void> => {
  const subs = [...billingStore.subscriptions.values()];
  json(res, { total: subs.length, items: subs });
});

// GET /api/v1/billing/admin/invoices
export const listAllInvoices = requirePermission('billing.manage')(async (
  ctx: RouteContext,
  res: ServerResponse
): Promise<void> => {
  const statusFilter = ctx.query.get('status') ?? '';
  let invoices = billingStore.invoices;
  if (statusFilter) {
    invoices = invoices.filter((i) => i.status === statusFilter);
  }
  invoices = [...invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  json(res, { total: invoices.length, items: invoices });
});
