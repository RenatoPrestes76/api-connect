'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPlans,
  fetchPlan,
  fetchSubscription,
  upgradePlan,
  downgradePlan,
  cancelSubscription,
  fetchInvoices,
  fetchInvoice,
  fetchUsage,
  fetchUsageHistory,
  fetchLicense,
  validateLicenseKey,
  fetchCustomerPortal,
  createCheckoutSession,
  fetchAdminDashboard,
  fetchAdminInvoices,
} from '@/services/billing.service';
import type { PlanSlug, BillingCycle } from '@/types/billing';

const DEMO_TENANT = 'tenant-professional';

// ─── Plans ────────────────────────────────────────────────────────────────────

export const usePlans = () => useQuery({ queryKey: ['billing', 'plans'], queryFn: fetchPlans });

export const usePlan = (slug: PlanSlug) =>
  useQuery({
    queryKey: ['billing', 'plan', slug],
    queryFn: () => fetchPlan(slug),
    enabled: !!slug,
  });

// ─── Subscription ─────────────────────────────────────────────────────────────

export const useSubscription = (tenantId = DEMO_TENANT) =>
  useQuery({
    queryKey: ['billing', 'subscription', tenantId],
    queryFn: () => fetchSubscription(tenantId),
  });

export const useUpgradePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tenantId,
      planSlug,
      billingCycle,
    }: {
      tenantId: string;
      planSlug: PlanSlug;
      billingCycle?: BillingCycle;
    }) => upgradePlan(tenantId, planSlug, billingCycle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });
};

export const useDowngradePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tenantId,
      planSlug,
      billingCycle,
    }: {
      tenantId: string;
      planSlug: PlanSlug;
      billingCycle?: BillingCycle;
    }) => downgradePlan(tenantId, planSlug, billingCycle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });
};

export const useCancelSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => cancelSubscription(tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });
};

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const useInvoices = (tenantId = DEMO_TENANT, status?: string) =>
  useQuery({
    queryKey: ['billing', 'invoices', tenantId, status],
    queryFn: () => fetchInvoices({ tenantId, status }),
  });

export const useInvoice = (id: string) =>
  useQuery({
    queryKey: ['billing', 'invoice', id],
    queryFn: () => fetchInvoice(id),
    enabled: !!id,
  });

// ─── Usage ────────────────────────────────────────────────────────────────────

export const useUsage = (tenantId = DEMO_TENANT) =>
  useQuery({
    queryKey: ['billing', 'usage', tenantId],
    queryFn: () => fetchUsage(tenantId),
  });

export const useUsageHistory = (tenantId = DEMO_TENANT) =>
  useQuery({
    queryKey: ['billing', 'usage-history', tenantId],
    queryFn: () => fetchUsageHistory(tenantId),
  });

// ─── License ─────────────────────────────────────────────────────────────────

export const useLicense = (tenantId = DEMO_TENANT) =>
  useQuery({
    queryKey: ['billing', 'license', tenantId],
    queryFn: () => fetchLicense(tenantId),
  });

export const useValidateLicense = () =>
  useMutation({
    mutationFn: ({ key, tenantId }: { key: string; tenantId: string }) =>
      validateLicenseKey(key, tenantId),
  });

// ─── Portal & Checkout ────────────────────────────────────────────────────────

export const useCustomerPortal = (tenantId = DEMO_TENANT) =>
  useQuery({
    queryKey: ['billing', 'customer-portal', tenantId],
    queryFn: () => fetchCustomerPortal(tenantId),
    enabled: false,
  });

export const useCreateCheckout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tenantId,
      planSlug,
      billingCycle,
    }: {
      tenantId: string;
      planSlug: PlanSlug;
      billingCycle: BillingCycle;
    }) => createCheckoutSession(tenantId, planSlug, billingCycle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export const useAdminDashboard = () =>
  useQuery({ queryKey: ['billing', 'admin', 'dashboard'], queryFn: fetchAdminDashboard });

export const useAdminInvoices = (status?: string) =>
  useQuery({
    queryKey: ['billing', 'admin', 'invoices', status],
    queryFn: () => fetchAdminInvoices(status),
  });
