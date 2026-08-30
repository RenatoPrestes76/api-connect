import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { billingStore } from '../../../modules/billing/billing-store.js';
import type { SubscriptionStatus } from '@seltriva/billing';

type StripeObject = Record<string, unknown>;

function getTenantId(obj: StripeObject): string | undefined {
  // In the simulation, we store tenantId in metadata
  const meta = obj['metadata'] as Record<string, string> | undefined;
  return meta?.['tenantId'];
}

/**
 * ATLAS 46.26 — this handler had NO Stripe signature verification and
 * trusted `metadata.tenantId` straight from the request body to sync
 * subscription/invoice state — a client-supplied identifier driving a
 * mutation, the exact anti-pattern behind every other fix in this sprint.
 * Before this fix, ANY caller holding nothing more than a valid Supabase
 * session (any signed-in tenant user, not specifically Stripe or staff)
 * could POST a forged `customer.subscription.updated`/`.deleted`/
 * `invoice.paid` event naming another tenant's id and silently grant that
 * tenant a free upgrade, cancel its subscription, or mark its invoices
 * paid — a real cross-tenant billing-state BOLA, arguably the most severe
 * billing finding in this audit.
 *
 * Fixed the same way as billing/admin.ts: gated behind the existing
 * `billing.manage` permission rather than inventing new authorization.
 *
 * EXTERNAL / DEFERRED FUNCTIONAL GAP (final hardening, Part 3 — explicitly
 * evaluated, not silently deferred): this route is not in
 * middleware/auth.ts's PUBLIC_PATH_PREFIXES, so the real Stripe service —
 * which authenticates with a `Stripe-Signature` header, not a Supabase
 * Bearer JWT — could not call this endpoint even before this fix, and
 * still can't after it. Confirmed this is safe to defer: there is no real
 * Stripe integration anywhere in this codebase today — no `stripe` SDK
 * dependency in any package.json, and modules/billing/stripe-simulation.ts
 * (the only "Stripe" this system talks to) fabricates
 * `checkout.stripe.com/demo/...` URLs locally rather than calling a real
 * Stripe API. A live Stripe account/webhook is therefore not part of this
 * version's Go-Live scope, so implementing raw-body plumbing (parseBody()
 * only exposes parsed JSON today) + Stripe-Signature verification +
 * STRIPE_WEBHOOK_SECRET + replay protection now would be unverifiable,
 * speculative work against an integration that doesn't exist yet. The
 * `billing.manage` gate stays as the interim protection. Before a real
 * Stripe integration ships, this handler MUST be redone to authenticate by
 * verified Stripe signature (not `requirePermission`) and to derive tenant
 * identity from the already-provisioned subscription/customer record, not
 * from `metadata.tenantId` in the payload.
 */
// POST /api/v1/billing/webhooks/stripe
export const handleStripeWebhook = requirePermission('billing.manage')(
  async function handleStripeWebhook(ctx: RouteContext, res: ServerResponse): Promise<void> {
    const body = ctx.body as
      | { id?: string; type?: string; data?: { object?: StripeObject } }
      | undefined;

    if (!body?.type || !body?.data?.object) {
      apiError(res, 'Invalid webhook payload', 400, 'VALIDATION_ERROR');
      return;
    }

    const { type } = body;
    const obj = body.data.object;

    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const tenantId = getTenantId(obj);
        if (tenantId) {
          const stripeSubId = String(obj['id'] ?? '');
          const stripeStatus = String(obj['status'] ?? 'active') as SubscriptionStatus;
          billingStore.syncStripeSubscription(tenantId, stripeSubId, stripeStatus);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const tenantId = getTenantId(obj);
        if (tenantId) {
          try {
            billingStore.cancelSubscription(tenantId);
          } catch {
            // subscription may already be canceled
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoiceId = String(obj['metadata_invoice_id'] ?? obj['id'] ?? '');
        const tenantId = getTenantId(obj);
        if (tenantId && invoiceId) {
          billingStore.markInvoicePaid(invoiceId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const tenantId = getTenantId(obj);
        if (tenantId) {
          const sub = billingStore.getSubscription(tenantId);
          if (sub) {
            billingStore.syncStripeSubscription(
              tenantId,
              sub.providerSubscriptionId ?? '',
              'past_due'
            );
          }
        }
        break;
      }

      case 'checkout.session.completed': {
        // Checkout completed — subscription activation is handled by subscription.created event
        break;
      }

      default:
        // Unknown event type — acknowledge and ignore
        break;
    }

    // Stripe expects a 200 to acknowledge receipt
    json(res, { received: true, type });
  }
);
