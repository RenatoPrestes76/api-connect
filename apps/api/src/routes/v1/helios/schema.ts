import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { tenantOf, assertTenantAccess } from './util.js';

export function registerSchemaRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/helios/schema', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const tenantId = tenantOf(ctx);
    const schemas = heliosStore.getSchemas({ status, tenantId });
    json(res, { schemas, total: schemas.length });
  });

  router.get('/api/v1/helios/schema/:id/versions', (ctx: RouteContext, res: ServerResponse) => {
    const eventType = ctx.params?.id as string;
    if (!assertTenantAccess(heliosStore.getTenantIdForEventType(eventType), ctx)) {
      return apiError(res, 'Schema not found for event type', 404, 'SCHEMA_NOT_FOUND');
    }
    const versions = heliosStore.getSchemaVersions(eventType);
    if (versions.length === 0)
      return apiError(res, 'Schema not found for event type', 404, 'SCHEMA_NOT_FOUND');
    json(res, { eventType, versions, total: versions.length });
  });

  router.post(
    '/api/v1/helios/schema/:id/rollback',
    async (ctx: RouteContext, res: ServerResponse) => {
      const eventType = ctx.params?.id as string;
      const body = ctx.body as { version?: string } | undefined;
      if (!body?.version) return apiError(res, 'version is required', 400, 'MISSING_VERSION');
      if (!assertTenantAccess(heliosStore.getTenantIdForEventType(eventType), ctx)) {
        return apiError(res, 'Schema not found for event type', 404, 'SCHEMA_NOT_FOUND');
      }
      const result = heliosStore.rollbackSchema(eventType, body.version);
      if (result === null)
        return apiError(res, 'Schema not found for event type', 404, 'SCHEMA_NOT_FOUND');
      if (result === 'VERSION_NOT_FOUND')
        return apiError(res, 'Version not found', 404, 'VERSION_NOT_FOUND');
      json(res, result);
    }
  );
}
