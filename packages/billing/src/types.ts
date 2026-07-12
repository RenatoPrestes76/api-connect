// ─── Plan ────────────────────────────────────────────────────────────────────

export type PlanSlug = 'community' | 'professional' | 'enterprise';
export type SupportLevel = 'community' | 'email' | 'priority' | 'dedicated';

export interface Plan {
  id: string;
  name: string;
  slug: PlanSlug;
  /** Monthly price in cents (0 = free). */
  monthlyPrice: number;
  /** Yearly price in cents (0 = free). */
  yearlyPrice: number;
  /** null = unlimited */
  maxAgents: number | null;
  maxConnectors: number | null;
  maxWorkflows: number | null;
  maxUsers: number | null;
  /** AI credits per billing period. null = unlimited */
  aiCredits: number | null;
  /** Requests per minute. 0 = custom (enterprise negotiated). */
  rateLimit: number;
  supportLevel: SupportLevel;
  features: string[];
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';

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
  provider: 'stripe' | 'manual' | 'free';
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── License ─────────────────────────────────────────────────────────────────

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'pending';

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
}

export interface LicenseValidationResult {
  valid: boolean;
  planSlug?: PlanSlug;
  tenantId?: string;
  expiresAt?: string | null;
  message: string;
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

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

// ─── Usage ───────────────────────────────────────────────────────────────────

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

export interface UsageLimitCheck {
  allowed: boolean;
  current: number;
  limit: number | null;
  resource: string;
}

// ─── Admin Metrics ───────────────────────────────────────────────────────────

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

// ─── Stripe Simulation ───────────────────────────────────────────────────────

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

export type StripeEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'checkout.session.completed';

export interface StripeWebhookEvent {
  id: string;
  type: StripeEventType;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}
