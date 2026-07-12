import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
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

function tenantId(ctx: RouteContext): string {
  return (ctx.headers['x-tenant-id'] as string) || ctx.query.get('tenantId') || 'tenant-enterprise';
}

export function registerSupportRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
}): void {
  router.get('/api/v1/portal/support', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') as SupportStatus | null;
    const tickets = portalStore.listTickets(tenantId(ctx), status ?? undefined);
    json(res, { total: tickets.length, tickets });
  });

  router.get('/api/v1/portal/support/:id', (ctx: RouteContext, res: ServerResponse) => {
    const ticket = portalStore.getTicket(ctx.params['id']!);
    if (!ticket) return apiError(res, 'Ticket not found', 404, 'NOT_FOUND');
    json(res, ticket);
  });

  router.post('/api/v1/portal/support', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { title, description, severity, category } = body;

    if (!title || !description) {
      return apiError(res, '"title" and "description" are required', 400, 'MISSING_FIELDS');
    }
    if (!VALID_SEVERITIES.includes(severity)) {
      return apiError(
        res,
        `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
        400,
        'INVALID_SEVERITY'
      );
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return apiError(
        res,
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        400,
        'INVALID_CATEGORY'
      );
    }

    const ticket = portalStore.createTicket({
      tenantId: tenantId(ctx),
      title,
      description,
      severity,
      category,
    });
    json(res, ticket, 201);
  });

  router.put('/api/v1/portal/support/:id/status', (ctx: RouteContext, res: ServerResponse) => {
    const { status } = (ctx.body as any) ?? {};
    if (!VALID_STATUSES.includes(status)) {
      return apiError(
        res,
        `status must be one of: ${VALID_STATUSES.join(', ')}`,
        400,
        'INVALID_STATUS'
      );
    }
    const ticket = portalStore.updateTicketStatus(ctx.params['id']!, status);
    if (!ticket) return apiError(res, 'Ticket not found', 404, 'NOT_FOUND');
    json(res, ticket);
  });
}
