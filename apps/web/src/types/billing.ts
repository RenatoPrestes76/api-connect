export type PlanSlug = 'community' | 'professional' | 'enterprise';
export type SupportLevel = 'community' | 'email' | 'priority' | 'dedicated';
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';
export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';
export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'pending';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Plan {
  id: string;
  name: string;
  slug: PlanSlug;
  monthlyPrice: number;
  yearlyPrice: number;
  maxAgents: number | null;
  maxConnectors: number | null;
  maxWorkflows: number | null;
  maxUsers: number | null;
  aiCredits: number | null;
  rateLimit: number;
  supportLevel: SupportLevel;
  features: string[];
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  planSlug: PlanSlug;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startsAt: string;
  endsAt: string | null;
  renewAt: string | null;
  cancelAt: string | null;
  provider: string;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface License {
  id: string;
  tenantId: string;
  key: string;
  planSlug: PlanSlug;
  status: LicenseStatus;
  expiresAt: string | null;
  issuedAt: string;
  lastValidatedAt: string | null;
  signature: string;
  fingerprint?: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  pdfUrl: string | null;
  issuedAt: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
}

export interface Usage {
  id: string;
  tenantId: string;
  month: string;
  agents: number;
  workflows: number;
  connectors: number;
  executions: number;
  apiCalls: number;
  aiTokens: number;
  aiCreditsUsed: number;
}

export interface UsageLimits {
  agents: number | null;
  connectors: number | null;
  workflows: number | null;
  users: number | null;
  aiCredits: number | null;
}

export interface BillingMetrics {
  mrr: number;
  arr: number;
  activeCustomers: number;
  trialingCustomers: number;
  communityUsers: number;
  churnedThisMonth: number;
  newThisMonth: number;
  totalAiCreditsUsed: number;
  topCustomers: Array<{ tenantId: string; planSlug: PlanSlug; spend: number }>;
  revenueByPlan: Record<PlanSlug, number>;
  expiringLicenses: Array<{ tenantId: string; licenseId: string; expiresAt: string }>;
  overdueInvoices: Invoice[];
}

export interface CheckoutSession {
  id: string;
  url: string;
  tenantId: string;
  planSlug: PlanSlug;
  billingCycle: BillingCycle;
  expiresAt: string;
}

export interface CustomerPortalSession {
  url: string;
  tenantId: string;
  createdAt: string;
}
