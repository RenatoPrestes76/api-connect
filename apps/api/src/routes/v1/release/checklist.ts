import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { releaseStore } from '../../../modules/release/release-store.js';
import type { ChecklistStatus } from '@seltriva/release';

const VALID_STATUSES: ChecklistStatus[] = ['pending', 'running', 'passed', 'failed', 'skipped'];

export function registerChecklistRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
}): void {
  router.get('/api/v1/release/checklist', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, releaseStore.checklist.getResult());
  });

  router.get('/api/v1/release/checklist/:id', (ctx: RouteContext, res: ServerResponse) => {
    const item = releaseStore.checklist.get(ctx.params['id']!);
    if (!item) return apiError(res, 'Checklist item not found', 404, 'NOT_FOUND');
    json(res, item);
  });

  router.put('/api/v1/release/checklist/:id', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { status, notes, checkedBy } = body;

    if (!VALID_STATUSES.includes(status)) {
      return apiError(
        res,
        `status must be one of: ${VALID_STATUSES.join(', ')}`,
        400,
        'INVALID_STATUS'
      );
    }

    const item = releaseStore.markChecklist(ctx.params['id']!, status, { notes, checkedBy });
    if (!item) return apiError(res, 'Checklist item not found', 404, 'NOT_FOUND');
    json(res, item);
  });
}
