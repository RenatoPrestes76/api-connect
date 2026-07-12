import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { billingStore } from '../../../modules/billing/billing-store.js';
import type { SubscriptionStatus } from '@seltriva/billing';

type StripeObject = Record<string, unknown>;

function getTenantId(obj: StripeObject): string | undefined {
  // In the simulation, we store tenantId in metadata
  const meta = obj['metadata'] as Record<string, string> | undefined;
  return meta?.['tenantId'];
}

// POST /api/v1/billing/webhooks/stripe
export async function handleStripeWebhook(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as
    | { id?: string; type?: string; data?: { object?: StripeObject } }
    | undefined;

  if (!body?.type || !body?.data?.object) {
    apiError(res, 'Invalid webhook payload', 400, 'VALIDATION_ERROR');
    return;
  }

  const { type, data } = body;
  const obj = data.object!;

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
