import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { governanceStore } from '../../../modules/governance/governance-store.js';
import type {
  ChangeStatus,
  ChangeType,
  ChangePriority,
} from '../../../modules/governance/types.js';

const VALID_STATUSES: ChangeStatus[] = [
  'pending',
  'approved',
  'rejected',
  'executing',
  'completed',
  'rolled_back',
];
const VALID_TYPES: ChangeType[] = [
  'infrastructure',
  'configuration',
  'deployment',
  'security',
  'data',
  'emergency',
];
const VALID_PRIORITIES: ChangePriority[] = ['critical', 'high', 'medium', 'low'];

export function registerChangesRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/changes
  router.get('/api/v1/changes', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const type = ctx.query.get('type') ?? undefined;
    const priority = ctx.query.get('priority') ?? undefined;

    if (status && !VALID_STATUSES.includes(status as ChangeStatus))
      return apiError(res, `Invalid status "${status}"`, 400, 'INVALID_STATUS');
    if (type && !VALID_TYPES.includes(type as ChangeType))
      return apiError(res, `Invalid type "${type}"`, 400, 'INVALID_TYPE');
    if (priority && !VALID_PRIORITIES.includes(priority as ChangePriority))
      return apiError(res, `Invalid priority "${priority}"`, 400, 'INVALID_PRIORITY');

    const changes = governanceStore.getChanges({
      status: status as ChangeStatus | undefined,
      type: type as ChangeType | undefined,
      priority: priority as ChangePriority | undefined,
    });

    json(res, { total: changes.length, changes });
  });

  // POST /api/v1/changes
  router.post('/api/v1/changes', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const {
      title,
      description,
      type,
      priority,
      requesterName,
      justification,
      rollbackPlan,
      scheduledAt,
      affectedSystems,
      tenantId,
    } = body;

    if (!title) return apiError(res, '"title" is required', 400, 'MISSING_FIELDS');
    if (!type) return apiError(res, '"type" is required', 400, 'MISSING_FIELDS');
    if (!justification) return apiError(res, '"justification" is required', 400, 'MISSING_FIELDS');
    if (!scheduledAt) return apiError(res, '"scheduledAt" is required', 400, 'MISSING_FIELDS');

    if (!VALID_TYPES.includes(type as ChangeType)) {
      return apiError(res, `Invalid type "${type}"`, 400, 'INVALID_TYPE');
    }
    if (priority && !VALID_PRIORITIES.includes(priority as ChangePriority)) {
      return apiError(res, `Invalid priority "${priority}"`, 400, 'INVALID_PRIORITY');
    }

    const change = governanceStore.createChange({
      title,
      description,
      type,
      priority,
      requesterName: requesterName ?? 'admin',
      justification,
      rollbackPlan,
      scheduledAt,
      affectedSystems,
      tenantId,
    });
    json(res, change, 201);
  });

  // POST /api/v1/changes/:id/approve
  router.post('/api/v1/changes/:id/approve', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params['id'];
    if (!id) return apiError(res, '"id" param required', 400, 'MISSING_FIELDS');

    const body = (ctx.body as any) ?? {};
    const { approverName = 'Admin', notes } = body;

    const change = governanceStore.getChange(id);
    if (!change) return apiError(res, `Change "${id}" not found`, 404, 'NOT_FOUND');
    if (change.status !== 'pending') {
      return apiError(
        res,
        `Change "${id}" is not pending (current status: ${change.status})`,
        400,
        'INVALID_STATUS'
      );
    }

    const updated = governanceStore.approveChange(id, approverName, notes);
    json(res, updated!);
  });

  // POST /api/v1/changes/:id/reject
  router.post('/api/v1/changes/:id/reject', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params['id'];
    if (!id) return apiError(res, '"id" param required', 400, 'MISSING_FIELDS');

    const body = (ctx.body as any) ?? {};
    const { rejectorName = 'Admin', reason } = body;

    if (!reason)
      return apiError(res, '"reason" is required to reject a change', 400, 'MISSING_FIELDS');

    const change = governanceStore.getChange(id);
    if (!change) return apiError(res, `Change "${id}" not found`, 404, 'NOT_FOUND');

    const updated = governanceStore.rejectChange(id, rejectorName, reason);
    json(res, updated!);
  });
}
