import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { connectorsStore } from '../../../modules/connectors/connectors-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { ConnectorCategory, ConnectorStatus } from '../../../modules/connectors/types.js';

const VALID_CATEGORIES: ConnectorCategory[] = [
  'DATABASE',
  'ERP',
  'REST_API',
  'SOAP',
  'FTP_SFTP',
  'MESSAGING',
  'FILES',
  'WEBHOOK',
  'CUSTOM',
];

interface CreateConnectorBody {
  identifier?: string;
  name?: string;
  category?: ConnectorCategory;
  vendor?: string;
  description?: string;
  icon?: string;
  minRuntimeVersion?: string;
}

export function registerConnectorRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/connector-registry/connectors',
    requirePermission('connector-registry.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const category = (ctx.query.get('category') as ConnectorCategory | null) ?? undefined;
      const status = (ctx.query.get('status') as ConnectorStatus | null) ?? undefined;
      const connectors = connectorsStore.listConnectors({ category, status });
      json(res, { total: connectors.length, connectors });
    })
  );

  router.get(
    '/admin/connector-registry/connectors/:id',
    requirePermission('connector-registry.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const connector = connectorsStore.getConnector(ctx.params['id'] as string);
      if (!connector) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
      json(res, connector);
    })
  );

  router.post(
    '/admin/connector-registry/connectors',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body ?? {}) as CreateConnectorBody;
        const { identifier, name, category, vendor, description, icon, minRuntimeVersion } = body;

        if (!identifier || !name || !category || !vendor || !description || !minRuntimeVersion) {
          return apiError(
            res,
            'identifier, name, category, vendor, description and minRuntimeVersion are required',
            400,
            'MISSING_FIELDS'
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

        const result = connectorsStore.createConnector({
          identifier,
          name,
          category,
          vendor,
          description,
          icon,
          minRuntimeVersion,
        });
        if (result === 'IDENTIFIER_TAKEN') {
          return apiError(
            res,
            `identifier "${identifier}" is already registered`,
            409,
            'IDENTIFIER_TAKEN'
          );
        }

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_REGISTERED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: result.id,
          metadata: { identifier: result.identifier, name: result.name },
        });

        json(res, result, 201);
      }
    )
  );

  router.patch(
    '/admin/connector-registry/connectors/:id',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body ?? {}) as Partial<CreateConnectorBody>;
        const id = ctx.params['id'] as string;
        const connector = connectorsStore.updateConnector(id, body);
        if (!connector) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_UPDATED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: id,
          metadata: body as Record<string, unknown>,
        });

        json(res, connector);
      }
    )
  );

  router.post(
    '/admin/connector-registry/connectors/:id/activate',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const id = ctx.params['id'] as string;
        const connector = connectorsStore.setConnectorStatus(id, 'active');
        if (!connector) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_ACTIVATED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: id,
        });

        json(res, connector);
      }
    )
  );

  router.post(
    '/admin/connector-registry/connectors/:id/deactivate',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const id = ctx.params['id'] as string;
        const connector = connectorsStore.setConnectorStatus(id, 'deprecated');
        if (!connector) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_DEACTIVATED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: id,
        });

        json(res, connector);
      }
    )
  );

  router.post(
    '/admin/connector-registry/connectors/:id/validate',
    requirePermission('connector-registry.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const connectorId = ctx.params['id'] as string;
      if (!connectorsStore.getConnector(connectorId)) {
        return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
      }
      const values = (ctx.body ?? {}) as Record<string, string | number | boolean | undefined>;
      const issues = connectorsStore.validateConfig(connectorId, values);
      json(res, { valid: issues.length === 0, issues });
    })
  );

  router.delete(
    '/admin/connector-registry/connectors/:id',
    requirePermission('connector-registry.delete')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const id = ctx.params['id'] as string;
        const ok = connectorsStore.deleteConnector(id);
        if (!ok) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_DELETED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: id,
        });

        json(res, { deleted: true });
      }
    )
  );
}
