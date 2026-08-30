import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { requirePortalAuth } from '../../../middleware/portal-auth.js';
import { portalStore } from '../../../modules/portal/portal-store.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import type { OnboardingStep } from '@seltriva/release';

interface CompleteStepBody {
  step?: OnboardingStep;
}

/**
 * ATLAS 46.26 — previously unauthenticated and scoped by a client-supplied
 * `x-tenant-id` header (`requireTenantId(ctx)`), letting any caller view or
 * advance any tenant's dashboard/onboarding — see the matching fix in
 * portal/connectors.ts and
 * docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md's "ATLAS 46.26" section.
 * `ctx.portalOrganizationId` is exactly the value this file's own prior
 * comment already said it should become "once the caller is a real,
 * logged-in portal session" — that session enforcement was never actually
 * wired in until now.
 */
export function registerPortalDashboardRoutes(router: Router): void {
  router.get(
    '/api/v1/portal/dashboard',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.portalOrganizationId as string;
      json(res, {
        ...portalStore.getDashboard(organizationId),
        organizationSummary: portalIdentityStore.getDashboardSummary(organizationId),
      });
    })
  );

  router.post(
    '/api/v1/portal/onboarding/complete-step',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const { step } = (ctx.body as CompleteStepBody | undefined) ?? {};
      if (!step) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'MISSING_STEP', message: '"step" is required' } }));
        return;
      }
      const progress = portalStore.completeStep(ctx.portalOrganizationId as string, step);
      if (!progress) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: { code: 'NOT_FOUND', message: 'Onboarding not found for tenant' },
          })
        );
        return;
      }
      json(res, { progress });
    })
  );
}
