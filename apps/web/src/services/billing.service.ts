import { api } from './api-client';
import type {
  Plan,
  Subscription,
  License,
  Invoice,
  Usage,
  UsageLimits,
  BillingMetrics,
  CheckoutSession,
  CustomerPortalSession,
  PlanSlug,
  BillingCycle,
} from '@/types/billing';

const BASE = '/api/v1/billing';

// ─── Plans ────────────────────────────────────────────────────────────────────

export const fetchPlans = (): Promise<{ plans: Plan[] }> => api.get(`${BASE}/plans`);
export const fetchPlan = (slug: PlanSlug): Promise<Plan> => api.get(`${BASE}/plans/${slug}`);

// ─── Subscription ─────────────────────────────────────────────────────────────

export const fetchSubscription = (
  tenantId: string
): Promise<{ subscription: Subscription; plan: Plan }> =>
  api.get(`${BASE}/subscription?tenantId=${tenantId}`);

export const upgradePlan = (
  tenantId: string,
  planSlug: PlanSlug,
  billingCycle: BillingCycle = 'monthly'
): Promise<{ subscription: Subscription; plan: Plan }> =>
  api.post(`${BASE}/upgrade?tenantId=${tenantId}`, { planSlug, billingCycle });

export const downgradePlan = (
  tenantId: string,
  planSlug: PlanSlug,
  billingCycle: BillingCycle = 'monthly'
): Promise<{ subscription: Subscription; plan: Plan }> =>
  api.post(`${BASE}/downgrade?tenantId=${tenantId}`, { planSlug, billingCycle });

export const cancelSubscription = (
  tenantId: string
): Promise<{ subscription: Subscription; message: string }> =>
  api.post(`${BASE}/cancel?tenantId=${tenantId}`, {});

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface ListInvoicesParams {
  tenantId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const fetchInvoices = (
  params: ListInvoicesParams
): Promise<{ total: number; items: Invoice[] }> => {
  const qs = new URLSearchParams({ tenantId: params.tenantId });
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  return api.get(`${BASE}/invoices?${qs.toString()}`);
};

export const fetchInvoice = (id: string): Promise<Invoice> => api.get(`${BASE}/invoices/${id}`);

// ─── Usage ────────────────────────────────────────────────────────────────────

export const fetchUsage = (
  tenantId: string
): Promise<{ usage: Usage; limits: UsageLimits; planSlug: PlanSlug }> =>
  api.get(`${BASE}/usage?tenantId=${tenantId}`);

export const fetchUsageHistory = (tenantId: string): Promise<{ total: number; items: Usage[] }> =>
  api.get(`${BASE}/usage/history?tenantId=${tenantId}`);

// ─── License ─────────────────────────────────────────────────────────────────

export const fetchLicense = (tenantId: string): Promise<License> =>
  api.get(`${BASE}/license?tenantId=${tenantId}`);

export const validateLicenseKey = (
  key: string,
  tenantId: string
): Promise<{ valid: boolean; planSlug?: PlanSlug; message: string }> =>
  api.post(`${BASE}/license/validate`, { key, tenantId });

// ─── Customer Portal & Checkout ───────────────────────────────────────────────

export const fetchCustomerPortal = (tenantId: string): Promise<CustomerPortalSession> =>
  api.get(`${BASE}/customer-portal?tenantId=${tenantId}`);

export const createCheckoutSession = (
  tenantId: string,
  planSlug: PlanSlug,
  billingCycle: BillingCycle
): Promise<CheckoutSession> =>
  api.post(`${BASE}/checkout?tenantId=${tenantId}`, { planSlug, billingCycle });

// ─── Admin ───────────────────────────────────────────────────────────────────

export const fetchAdminDashboard = (): Promise<BillingMetrics> =>
  api.get(`${BASE}/admin/dashboard`);

export const fetchAdminInvoices = (
  status?: string
): Promise<{ total: number; items: Invoice[] }> => {
  const qs = status ? `?status=${status}` : '';
  return api.get(`${BASE}/admin/invoices${qs}`);
};
