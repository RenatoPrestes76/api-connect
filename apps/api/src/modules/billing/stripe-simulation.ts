import type {
  CheckoutSession,
  CustomerPortalSession,
  PlanSlug,
  BillingCycle,
} from '@seltriva/billing';

/**
 * Simulated Stripe integration — no real HTTP calls.
 * All sessions and events are stored in-memory and expire after 30 minutes.
 */
class StripeSimulation {
  private checkoutSessions: Map<string, CheckoutSession> = new Map();

  createCheckoutSession(
    tenantId: string,
    planSlug: PlanSlug,
    billingCycle: BillingCycle
  ): CheckoutSession {
    const id = `cs_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const session: CheckoutSession = {
      id,
      url: `https://checkout.stripe.com/demo/pay/${id}`,
      tenantId,
      planSlug,
      billingCycle,
      expiresAt,
    };
    this.checkoutSessions.set(id, session);
    return session;
  }

  getCheckoutSession(id: string): CheckoutSession | undefined {
    return this.checkoutSessions.get(id);
  }

  createCustomerPortalSession(tenantId: string): CustomerPortalSession {
    const sessionId = `bps_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      url: `https://billing.stripe.com/demo/p/${sessionId}?tenant=${tenantId}`,
      tenantId,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Builds a simulated Stripe webhook event payload.
   * Use this in tests or to manually trigger subscription state changes.
   */
  buildEvent(type: string, object: Record<string, unknown>): Record<string, unknown> {
    return {
      id: `evt_demo_${Date.now()}`,
      type,
      created: Math.floor(Date.now() / 1000),
      data: { object },
    };
  }
}

export const stripeSimulation = new StripeSimulation();
