import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { erpMetadataStore } from '../../../modules/erp-metadata/erp-metadata-store.js';
import { parseQuery } from '../../../http/validation.js';
import { ListRequestsQuerySchema } from './schemas.js';

export function registerErpMetadataAdminRoutes(router: Router): void {
  // ─── GET /erp-metadata/requests ───────────────────────────────────────────
  router.get(
    '/erp-metadata/requests',
    requirePermission('erp-metadata.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const query = parseQuery(ListRequestsQuerySchema, ctx, res);
      if (!query) return;
      const requests = erpMetadataStore.listRequests(query);
      json(res, {
        total: requests.length,
        requests: requests.map((r) => erpMetadataStore.toDTO(r)),
      });
    })
  );

  // ─── GET /erp-metadata/requests/:id ───────────────────────────────────────
  router.get(
    '/erp-metadata/requests/:id',
    requirePermission('erp-metadata.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const request = erpMetadataStore.getRequest(ctx.params['id'] as string);
      if (!request) return apiError(res, 'Discovery request not found', 404, 'NOT_FOUND');
      json(res, { request: erpMetadataStore.toDTO(request) });
    })
  );
}
