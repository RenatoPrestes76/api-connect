import { PLANS, generateLicenseKey, generateSignature } from '@seltriva/billing';
import type {
  Plan,
  Subscription,
  License,
  Invoice,
  Usage,
  PlanSlug,
  BillingMetrics,
  SubscriptionStatus,
  BillingCycle,
} from '@seltriva/billing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function monthStr(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function isoMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

let _invSeq = 7;
function nextInvoiceNumber(): string {
  return `INV-2026-${String(++_invSeq).padStart(4, '0')}`;
}

// ─── Seeded Tenants (demo identifiers only — no Prisma) ──────────────────────

const DEMO_TENANTS = ['tenant-community', 'tenant-professional', 'tenant-enterprise'] as const;
type DemoTenant = (typeof DEMO_TENANTS)[number];

// ─── BillingStore ─────────────────────────────────────────────────────────────

class BillingStore {
  plans: Plan[] = PLANS;
  subscriptions: Map<string, Subscription> = new Map();
  licenses: Map<string, License> = new Map();
  invoices: Invoice[] = [];
  usageRecords: Usage[] = [];

  constructor() {
    this._seed();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getSubscription(tenantId: string): Subscription | undefined {
    return [...this.subscriptions.values()].find((s) => s.tenantId === tenantId);
  }

  getLicense(tenantId: string): License | undefined {
    return [...this.licenses.values()].find((l) => l.tenantId === tenantId);
  }

  getInvoices(tenantId: string): Invoice[] {
    return this.invoices.filter((i) => i.tenantId === tenantId);
  }

  getInvoiceById(id: string): Invoice | undefined {
    return this.invoices.find((i) => i.id === id);
  }

  getCurrentUsage(tenantId: string): Usage | undefined {
    const month = monthStr(0);
    return this.usageRecords.find((u) => u.tenantId === tenantId && u.month === month);
  }

  getUsageHistory(tenantId: string): Usage[] {
    return this.usageRecords.filter((u) => u.tenantId === tenantId);
  }

  changePlan(tenantId: string, newPlanSlug: PlanSlug, billingCycle: BillingCycle): Subscription {
    const sub = this.getSubscription(tenantId);
    const plan = PLANS.find((p) => p.slug === newPlanSlug)!;

    if (sub) {
      const updated: Subscription = {
        ...sub,
        planId: plan.id,
        planSlug: newPlanSlug,
        billingCycle,
        renewAt: isoDate(billingCycle === 'yearly' ? 365 : 30),
        updatedAt: now(),
      };
      this.subscriptions.set(sub.id, updated);

      // Re-issue license
      this._reissueLicense(tenantId, newPlanSlug, billingCycle);
      return updated;
    }

    return this._createSubscription(tenantId, newPlanSlug, billingCycle);
  }

  cancelSubscription(tenantId: string): Subscription {
    const sub = this.getSubscription(tenantId);
    if (!sub) throw new Error('Subscription not found');

    const updated: Subscription = {
      ...sub,
      status: 'canceled',
      cancelAt: now(),
      updatedAt: now(),
    };
    this.subscriptions.set(sub.id, updated);

    // Revoke license
    const lic = this.getLicense(tenantId);
    if (lic) {
      this.licenses.set(lic.id, { ...lic, status: 'revoked' });
    }
    return updated;
  }

  validateLicense(
    key: string,
    tenantId: string
  ): { valid: boolean; planSlug?: PlanSlug; message: string } {
    const lic = this.getLicense(tenantId);
    if (!lic) return { valid: false, message: 'License not found for tenant' };
    if (lic.key !== key) return { valid: false, message: 'License key mismatch' };
    if (lic.status === 'revoked') return { valid: false, message: 'License has been revoked' };
    if (lic.status === 'expired') return { valid: false, message: 'License has expired' };
    if (lic.expiresAt && new Date(lic.expiresAt) < new Date()) {
      this.licenses.set(lic.id, { ...lic, status: 'expired' });
      return { valid: false, message: 'License has expired' };
    }

    const sigOk = generateSignature(key, tenantId, lic.planSlug);
    if (sigOk !== lic.signature) return { valid: false, message: 'Invalid license signature' };

    // Record last validation time
    this.licenses.set(lic.id, { ...lic, lastValidatedAt: now() });
    return { valid: true, planSlug: lic.planSlug, message: 'License is valid' };
  }

  recordUsageCredit(tenantId: string, creditsUsed: number): void {
    const month = monthStr(0);
    const existing = this.usageRecords.find((u) => u.tenantId === tenantId && u.month === month);
    if (existing) {
      existing.aiCreditsUsed += creditsUsed;
      existing.apiCalls += 1;
    }
  }

  computeMetrics(): BillingMetrics {
    const active = [...this.subscriptions.values()].filter(
      (s) => s.status === 'active' && s.planSlug !== 'community'
    );
    const trialing = [...this.subscriptions.values()].filter((s) => s.status === 'trialing');
    const community = [...this.subscriptions.values()].filter((s) => s.planSlug === 'community');

    let mrr = 0;
    const revenueByPlan: Record<PlanSlug, number> = {
      community: 0,
      professional: 0,
      enterprise: 0,
    };

    for (const sub of active) {
      const plan = PLANS.find((p) => p.slug === sub.planSlug)!;
      const monthly =
        sub.billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
      mrr += monthly;
      revenueByPlan[sub.planSlug] += monthly;
    }

    const totalAiCredits = this.usageRecords.reduce((sum, u) => sum + u.aiCreditsUsed, 0);

    const topCustomers = active.map((sub) => {
      const plan = PLANS.find((p) => p.slug === sub.planSlug)!;
      const spend =
        sub.billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
      return { tenantId: sub.tenantId, planSlug: sub.planSlug, spend };
    });

    const now30 = new Date();
    now30.setDate(now30.getDate() + 30);
    const expiring = [...this.licenses.values()].filter(
      (l) => l.expiresAt && new Date(l.expiresAt) < now30 && l.status === 'active'
    );

    const overdue = this.invoices.filter((i) => i.status === 'open');

    return {
      mrr,
      arr: mrr * 12,
      activeCustomers: active.length,
      trialingCustomers: trialing.length,
      communityUsers: community.length,
      churnedThisMonth: 1,
      newThisMonth: 1,
      totalAiCreditsUsed: totalAiCredits,
      topCustomers: topCustomers.sort((a, b) => b.spend - a.spend),
      revenueByPlan,
      expiringLicenses: expiring.map((l) => ({
        tenantId: l.tenantId,
        licenseId: l.id,
        expiresAt: l.expiresAt!,
      })),
      overdueInvoices: overdue,
    };
  }

  // ── Invoice helpers ─────────────────────────────────────────────────────────

  createInvoice(
    tenantId: string,
    subscriptionId: string,
    planSlug: PlanSlug,
    billingCycle: BillingCycle
  ): Invoice {
    const plan = PLANS.find((p) => p.slug === planSlug)!;
    const subtotal = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    const tax = Math.round(subtotal * 0.1);
    const inv: Invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId,
      subscriptionId,
      number: nextInvoiceNumber(),
      status: 'open',
      currency: 'USD',
      subtotal,
      discount: 0,
      tax,
      total: subtotal + tax,
      pdfUrl: null,
      issuedAt: now(),
      paidAt: null,
      periodStart: now(),
      periodEnd: isoDate(billingCycle === 'yearly' ? 365 : 30),
    };
    this.invoices.push(inv);
    return inv;
  }

  markInvoicePaid(invoiceId: string): Invoice | undefined {
    const inv = this.invoices.find((i) => i.id === invoiceId);
    if (!inv) return undefined;
    inv.status = 'paid';
    inv.paidAt = now();
    return inv;
  }

  // ── Stripe simulation helpers ───────────────────────────────────────────────

  syncStripeSubscription(tenantId: string, stripeSubId: string, status: SubscriptionStatus): void {
    const sub = this.getSubscription(tenantId);
    if (!sub) return;
    this.subscriptions.set(sub.id, {
      ...sub,
      status,
      providerSubscriptionId: stripeSubId,
      updatedAt: now(),
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _createSubscription(
    tenantId: string,
    planSlug: PlanSlug,
    billingCycle: BillingCycle
  ): Subscription {
    const plan = PLANS.find((p) => p.slug === planSlug)!;
    const subId = `sub-${tenantId}-${Date.now()}`;
    const sub: Subscription = {
      id: subId,
      tenantId,
      planId: plan.id,
      planSlug,
      status: 'active',
      billingCycle,
      startsAt: now(),
      endsAt: null,
      renewAt: isoDate(billingCycle === 'yearly' ? 365 : 30),
      cancelAt: null,
      provider: planSlug === 'community' ? 'free' : 'stripe',
      providerSubscriptionId: planSlug === 'community' ? null : `sub_demo_${tenantId}`,
      providerCustomerId: planSlug === 'community' ? null : `cus_demo_${tenantId}`,
      trialEndsAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.subscriptions.set(subId, sub);
    this._issueLicense(tenantId, planSlug, billingCycle);
    return sub;
  }

  private _issueLicense(tenantId: string, planSlug: PlanSlug, billingCycle: BillingCycle): void {
    const id = `lic-${tenantId}`;
    const key = generateLicenseKey(tenantId, planSlug);
    const sig = generateSignature(key, tenantId, planSlug);
    const expiresAt =
      planSlug === 'community' ? null : isoDate(billingCycle === 'yearly' ? 365 : 30);
    this.licenses.set(id, {
      id,
      tenantId,
      key,
      planSlug,
      status: 'active',
      expiresAt,
      issuedAt: now(),
      lastValidatedAt: null,
      signature: sig,
    });
  }

  private _reissueLicense(tenantId: string, planSlug: PlanSlug, billingCycle: BillingCycle): void {
    this._issueLicense(tenantId, planSlug, billingCycle);
  }

  private _seed(): void {
    // ── Subscriptions ──────────────────────────────────────────────────────────

    const communitySubId = 'sub-community-demo';
    this.subscriptions.set(communitySubId, {
      id: communitySubId,
      tenantId: 'tenant-community',
      planId: 'plan-community',
      planSlug: 'community',
      status: 'active',
      billingCycle: 'monthly',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: null,
      renewAt: null,
      cancelAt: null,
      provider: 'free',
      providerSubscriptionId: null,
      providerCustomerId: null,
      trialEndsAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const proSubId = 'sub-professional-demo';
    this.subscriptions.set(proSubId, {
      id: proSubId,
      tenantId: 'tenant-professional',
      planId: 'plan-professional',
      planSlug: 'professional',
      status: 'active',
      billingCycle: 'monthly',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: null,
      renewAt: '2026-08-01T00:00:00.000Z',
      cancelAt: null,
      provider: 'stripe',
      providerSubscriptionId: 'sub_pro_demo_001',
      providerCustomerId: 'cus_pro_demo_001',
      trialEndsAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const entSubId = 'sub-enterprise-demo';
    this.subscriptions.set(entSubId, {
      id: entSubId,
      tenantId: 'tenant-enterprise',
      planId: 'plan-enterprise',
      planSlug: 'enterprise',
      status: 'active',
      billingCycle: 'yearly',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: null,
      renewAt: '2027-01-01T00:00:00.000Z',
      cancelAt: null,
      provider: 'stripe',
      providerSubscriptionId: 'sub_ent_demo_001',
      providerCustomerId: 'cus_ent_demo_001',
      trialEndsAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    // ── Licenses ───────────────────────────────────────────────────────────────

    const seedLicense = (tenantId: string, planSlug: PlanSlug, expiresAt: string | null) => {
      const id = `lic-${tenantId}`;
      const key = generateLicenseKey(tenantId, planSlug);
      const sig = generateSignature(key, tenantId, planSlug);
      this.licenses.set(id, {
        id,
        tenantId,
        key,
        planSlug,
        status: 'active',
        expiresAt,
        issuedAt: '2026-01-01T00:00:00.000Z',
        lastValidatedAt: null,
        signature: sig,
      });
    };

    seedLicense('tenant-community', 'community', null);
    seedLicense('tenant-professional', 'professional', '2026-08-01T00:00:00.000Z');
    seedLicense('tenant-enterprise', 'enterprise', '2027-01-01T00:00:00.000Z');

    // ── Invoices ───────────────────────────────────────────────────────────────

    const makeInvoice = (
      id: string,
      number: string,
      tenantId: string,
      subId: string,
      subtotal: number,
      status: 'paid' | 'open',
      issuedAt: string,
      paidAt: string | null,
      periodStart: string,
      periodEnd: string
    ): Invoice => ({
      id,
      tenantId,
      subscriptionId: subId,
      number,
      status,
      currency: 'USD',
      subtotal,
      discount: 0,
      tax: Math.round(subtotal * 0.1),
      total: subtotal + Math.round(subtotal * 0.1),
      pdfUrl: `https://billing.seltriva.dev/invoices/${id}.pdf`,
      issuedAt,
      paidAt,
      periodStart,
      periodEnd,
    });

    this.invoices.push(
      makeInvoice(
        'inv-pro-2026-01',
        'INV-2026-0001',
        'tenant-professional',
        proSubId,
        4900,
        'paid',
        '2026-01-01T00:00:00.000Z',
        '2026-01-05T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z'
      ),
      makeInvoice(
        'inv-pro-2026-02',
        'INV-2026-0002',
        'tenant-professional',
        proSubId,
        4900,
        'paid',
        '2026-02-01T00:00:00.000Z',
        '2026-02-03T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
        '2026-03-01T00:00:00.000Z'
      ),
      makeInvoice(
        'inv-pro-2026-03',
        'INV-2026-0003',
        'tenant-professional',
        proSubId,
        4900,
        'paid',
        '2026-03-01T00:00:00.000Z',
        '2026-03-04T00:00:00.000Z',
        '2026-03-01T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z'
      ),
      makeInvoice(
        'inv-pro-2026-04',
        'INV-2026-0004',
        'tenant-professional',
        proSubId,
        4900,
        'paid',
        '2026-04-01T00:00:00.000Z',
        '2026-04-02T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z',
        '2026-05-01T00:00:00.000Z'
      ),
      makeInvoice(
        'inv-pro-2026-05',
        'INV-2026-0005',
        'tenant-professional',
        proSubId,
        4900,
        'paid',
        '2026-05-01T00:00:00.000Z',
        '2026-05-03T00:00:00.000Z',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z'
      ),
      makeInvoice(
        'inv-pro-2026-06',
        'INV-2026-0006',
        'tenant-professional',
        proSubId,
        4900,
        'open',
        '2026-06-01T00:00:00.000Z',
        null,
        '2026-06-01T00:00:00.000Z',
        '2026-07-01T00:00:00.000Z'
      ),
      makeInvoice(
        'inv-ent-2026-01',
        'INV-2026-0007',
        'tenant-enterprise',
        entSubId,
        299000,
        'paid',
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
        '2027-01-01T00:00:00.000Z'
      )
    );

    // ── Usage records ──────────────────────────────────────────────────────────

    const makeUsage = (
      tenantId: DemoTenant,
      month: string,
      agents: number,
      workflows: number,
      connectors: number,
      executions: number,
      apiCalls: number,
      aiTokens: number,
      aiCreditsUsed: number
    ): Usage => ({
      id: `usage-${tenantId}-${month}`,
      tenantId,
      month,
      agents,
      workflows,
      connectors,
      executions,
      apiCalls,
      aiTokens,
      aiCreditsUsed,
    });

    // Current month usage
    const cur = isoMonth(2026, 7);
    this.usageRecords.push(
      makeUsage('tenant-community', cur, 1, 2, 1, 45, 120, 3200, 38),
      makeUsage('tenant-professional', cur, 4, 18, 9, 1240, 5300, 87000, 412),
      makeUsage('tenant-enterprise', cur, 22, 88, 30, 9800, 34000, 650000, 0)
    );

    // Previous months
    for (let m = 1; m <= 6; m++) {
      const month = isoMonth(2026, m);
      this.usageRecords.push(
        makeUsage(
          'tenant-professional',
          month,
          3 + m,
          15 + m,
          8,
          1000 + m * 50,
          4800 + m * 100,
          75000 + m * 3000,
          300 + m * 20
        ),
        makeUsage(
          'tenant-enterprise',
          month,
          18 + m,
          75 + m,
          28,
          8500 + m * 200,
          30000 + m * 500,
          580000 + m * 12000,
          0
        )
      );
    }
  }
}

export const billingStore = new BillingStore();
