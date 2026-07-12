import type { Router } from '../../../http/router.js';
import { listPlans, getPlanBySlug } from './plans.js';
import { getSubscription, upgradePlan, downgradePlan, cancelPlan } from './subscription.js';
import { listInvoices, getInvoice } from './invoices.js';
import { getUsage, getUsageHistory } from './usage.js';
import { getLicense, validateLicense } from './license.js';
import { getAdminDashboard, listAllSubscriptions, listAllInvoices } from './admin.js';
import { handleStripeWebhook } from './stripe-webhooks.js';
import { getCustomerPortal, createCheckout } from './customer-portal.js';

export function registerBillingRoutes(router: Router): void {
  // Plans
  router.get('/api/v1/billing/plans', listPlans);
  router.get('/api/v1/billing/plans/:slug', getPlanBySlug);

  // Subscription lifecycle
  router.get('/api/v1/billing/subscription', getSubscription);
  router.post('/api/v1/billing/upgrade', upgradePlan);
  router.post('/api/v1/billing/downgrade', downgradePlan);
  router.post('/api/v1/billing/cancel', cancelPlan);

  // Invoices
  router.get('/api/v1/billing/invoices', listInvoices);
  router.get('/api/v1/billing/invoices/:id', getInvoice);

  // Usage
  router.get('/api/v1/billing/usage', getUsage);
  router.get('/api/v1/billing/usage/history', getUsageHistory);

  // License
  router.get('/api/v1/billing/license', getLicense);
  router.post('/api/v1/billing/license/validate', validateLicense);

  // Customer portal & checkout
  router.get('/api/v1/billing/customer-portal', getCustomerPortal);
  router.post('/api/v1/billing/checkout', createCheckout);

  // Stripe webhooks
  router.post('/api/v1/billing/webhooks/stripe', handleStripeWebhook);

  // Admin
  router.get('/api/v1/billing/admin/dashboard', getAdminDashboard);
  router.get('/api/v1/billing/admin/subscriptions', listAllSubscriptions);
  router.get('/api/v1/billing/admin/invoices', listAllInvoices);
}
