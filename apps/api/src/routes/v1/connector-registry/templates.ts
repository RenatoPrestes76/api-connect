import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { connectorsStore } from '../../../modules/connectors/connectors-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

interface CreateTemplateBody {
  name?: string;
  description?: string;
  values?: Record<string, string | number | boolean>;
}

export function registerConnectorTemplateRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/connector-registry/connectors/:id/templates',
    requirePermission('connector-registry.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const connectorId = ctx.params['id'] as string;
      if (!connectorsStore.getConnector(connectorId)) {
        return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
      }
      const templates = connectorsStore
        .listTemplates(connectorId)
        .map((t) => connectorsStore.toTemplateDTO(t));
      json(res, { total: templates.length, templates });
    })
  );

  router.post(
    '/admin/connector-registry/connectors/:id/templates',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const connectorId = ctx.params['id'] as string;
        if (!connectorsStore.getConnector(connectorId)) {
          return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
        }
        const body = (ctx.body ?? {}) as CreateTemplateBody;
        if (!body.name || !body.values) {
          return apiError(res, 'name and values are required', 400, 'MISSING_FIELDS');
        }

        const result = connectorsStore.createTemplate(connectorId, {
          name: body.name,
          description: body.description,
          values: body.values,
        });
        if (Array.isArray(result)) {
          return json(
            res,
            {
              error: { code: 'VALIDATION_FAILED', message: 'Configuration failed validation' },
              issues: result,
            },
            422
          );
        }

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_TEMPLATE_CREATED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: connectorId,
          metadata: { templateId: result.id, name: result.name },
        });

        json(res, connectorsStore.toTemplateDTO(result), 201);
      }
    )
  );

  router.delete(
    '/admin/connector-registry/connectors/:id/templates/:templateId',
    requirePermission('connector-registry.delete')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const connectorId = ctx.params['id'] as string;
        const templateId = ctx.params['templateId'] as string;
        const ok = connectorsStore.deleteTemplate(connectorId, templateId);
        if (!ok) return apiError(res, 'Template not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_TEMPLATE_DELETED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: connectorId,
          metadata: { templateId },
        });

        json(res, { deleted: true });
      }
    )
  );
}
