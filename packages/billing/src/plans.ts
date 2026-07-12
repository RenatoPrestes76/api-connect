import type { Plan, PlanSlug } from './types.js';

export const PLANS: Plan[] = [
  {
    id: 'plan-community',
    name: 'Community',
    slug: 'community',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxAgents: 1,
    maxConnectors: 2,
    maxWorkflows: 5,
    maxUsers: 2,
    aiCredits: 100,
    rateLimit: 100,
    supportLevel: 'community',
    features: [
      '1 Agent',
      '2 Connectors',
      '5 Workflows',
      '2 Users',
      '100 AI Credits / month',
      'Community forum support',
    ],
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
  },
  {
    id: 'plan-professional',
    name: 'Professional',
    slug: 'professional',
    monthlyPrice: 4900,
    yearlyPrice: 49000,
    maxAgents: 10,
    maxConnectors: 30,
    maxWorkflows: null,
    maxUsers: 10,
    aiCredits: 1000,
    rateLimit: 500,
    supportLevel: 'email',
    features: [
      '10 Agents',
      '30 Connectors',
      'Unlimited Workflows',
      '10 Users',
      '1 000 AI Credits / month',
      'Email & chat support',
      'Priority onboarding',
      'Advanced analytics',
    ],
    stripePriceIdMonthly: 'price_professional_monthly',
    stripePriceIdYearly: 'price_professional_yearly',
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    monthlyPrice: 29900,
    yearlyPrice: 299000,
    maxAgents: null,
    maxConnectors: null,
    maxWorkflows: null,
    maxUsers: null,
    aiCredits: null,
    rateLimit: 0,
    supportLevel: 'dedicated',
    features: [
      'Unlimited Agents',
      'Unlimited Connectors',
      'Unlimited Workflows',
      'Unlimited Users',
      'Unlimited AI Credits',
      'SSO / SAML',
      'Multi-Region deployment',
      'High Availability (99.99% SLA)',
      'Full audit logs',
      'Dedicated success manager',
      'Custom rate limits',
      'On-premise option',
    ],
    stripePriceIdMonthly: 'price_enterprise_monthly',
    stripePriceIdYearly: 'price_enterprise_yearly',
  },
];

export function getPlan(slug: PlanSlug): Plan | undefined {
  return PLANS.find((p) => p.slug === slug);
}

export function getPlanById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function listPlans(): Plan[] {
  return PLANS;
}
