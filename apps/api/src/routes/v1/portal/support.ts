import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePortalAuth } from '../../../middleware/portal-auth.js';
import { portalStore } from '../../../modules/portal/portal-store.js';
import type { SupportSeverity, SupportCategory, SupportStatus } from '@seltriva/release';

const VALID_SEVERITIES: SupportSeverity[] = ['P1', 'P2', 'P3', 'P4'];
const VALID_CATEGORIES: SupportCategory[] = [
  'billing',
  'technical',
  'security',
  'integration',
  'other',
];
const VALID_STATUSES: SupportStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

interface CreateTicketBody {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
}

interface UpdateTicketStatusBody {
  status?: string;
}

/**
 * ATLAS 46.26 — every route here was previously unauthenticated (see the
 * matching fix in portal/connectors.ts and
 * docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md's "ATLAS 46.26" section).
 * `GET .../support/:id` and `PUT .../support/:id/status` were the most
 * severe: they took the ticket id from the URL alone, with no tenant check
 * of any kind — any caller could read or change the status of any other
 * tenant's support ticket by id, authenticated or not. Fixed by requiring
 * a real portal session and passing `ctx.portalOrganizationId` (server-
 * derived from the verified session, never client-supplied) into every
 * store call, including the two `:id` routes, which now verify the ticket
 * actually belongs to the caller before returning or mutating it.
 */
export function registerSupportRoutes(router: Router): void {
  router.get(
    '/api/v1/portal/support',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const status = ctx.query.get('status') as SupportStatus | null;
      const tickets = portalStore.listTickets(
        ctx.portalOrganizationId as string,
        status ?? undefined
      );
      json(res, { total: tickets.length, tickets });
    })
  );

  router.get(
    '/api/v1/portal/support/:id',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const ticket = portalStore.getTicket(ctx.params['id'], ctx.portalOrganizationId as string);
      if (!ticket) return apiError(res, 'Ticket not found', 404, 'NOT_FOUND');
      json(res, ticket);
    })
  );

  router.post(
    '/api/v1/portal/support',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as CreateTicketBody | undefined) ?? {};
      const { title, description, severity, category } = body;

      if (!title || !description) {
        return apiError(res, '"title" and "description" are required', 400, 'MISSING_FIELDS');
      }
      if (!severity || !VALID_SEVERITIES.includes(severity as SupportSeverity)) {
        return apiError(
          res,
          `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
          400,
          'INVALID_SEVERITY'
        );
      }
      if (!category || !VALID_CATEGORIES.includes(category as SupportCategory)) {
        return apiError(
          res,
          `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
          400,
          'INVALID_CATEGORY'
        );
      }

      const ticket = portalStore.createTicket({
        tenantId: ctx.portalOrganizationId as string,
        title,
        description,
        severity: severity as SupportSeverity,
        category: category as SupportCategory,
      });
      json(res, ticket, 201);
    })
  );

  router.put(
    '/api/v1/portal/support/:id/status',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const { status } = (ctx.body as UpdateTicketStatusBody | undefined) ?? {};
      if (!status || !VALID_STATUSES.includes(status as SupportStatus)) {
        return apiError(
          res,
          `status must be one of: ${VALID_STATUSES.join(', ')}`,
          400,
          'INVALID_STATUS'
        );
      }
      const ticket = portalStore.updateTicketStatus(
        ctx.params['id'],
        ctx.portalOrganizationId as string,
        status as SupportStatus
      );
      if (!ticket) return apiError(res, 'Ticket not found', 404, 'NOT_FOUND');
      json(res, ticket);
    })
  );
}
