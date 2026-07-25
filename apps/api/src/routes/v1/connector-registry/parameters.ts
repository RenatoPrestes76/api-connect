import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { connectorsStore } from '../../../modules/connectors/connectors-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { ParameterType } from '../../../modules/connectors/types.js';

const VALID_TYPES: ParameterType[] = ['string', 'number', 'boolean', 'secret', 'enum', 'url'];

interface CreateParameterBody {
  key?: string;
  label?: string;
  type?: ParameterType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  validationPattern?: string;
  options?: string[];
  sensitive?: boolean;
  description?: string;
  order?: number;
  requiredIf?: { key: string; equals: string | number | boolean };
}

export function registerConnectorParameterRoutes(router: Router): void {
  router.get(
    '/admin/connector-registry/connectors/:id/parameters',
    requirePermission('connector-registry.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const connectorId = ctx.params['id'] as string;
      if (!connectorsStore.getConnector(connectorId)) {
        return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
      }
      const parameters = connectorsStore.listParameters(connectorId);
      json(res, { total: parameters.length, parameters });
    })
  );

  router.post(
    '/admin/connector-registry/connectors/:id/parameters',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const connectorId = ctx.params['id'] as string;
        if (!connectorsStore.getConnector(connectorId)) {
          return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
        }
        const body = (ctx.body ?? {}) as CreateParameterBody;
        const { key, label, type } = body;

        if (!key || !label || !type) {
          return apiError(res, 'key, label and type are required', 400, 'MISSING_FIELDS');
        }
        if (!VALID_TYPES.includes(type)) {
          return apiError(
            res,
            `type must be one of: ${VALID_TYPES.join(', ')}`,
            400,
            'INVALID_TYPE'
          );
        }
        if (type === 'enum' && (!body.options || body.options.length === 0)) {
          return apiError(
            res,
            'enum parameters require a non-empty "options" array',
            400,
            'MISSING_OPTIONS'
          );
        }

        const parameter = connectorsStore.createParameter(connectorId, {
          key,
          label,
          type,
          required: body.required ?? false,
          defaultValue: type === 'secret' ? undefined : body.defaultValue,
          validationPattern: body.validationPattern,
          options: body.options,
          sensitive: body.sensitive ?? type === 'secret',
          description: body.description,
          order: body.order ?? connectorsStore.listParameters(connectorId).length,
          requiredIf: body.requiredIf,
        });

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_PARAMETER_UPDATED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: connectorId,
          metadata: { parameterId: parameter.id, key: parameter.key, event: 'created' },
        });

        json(res, parameter, 201);
      }
    )
  );

  router.patch(
    '/admin/connector-registry/connectors/:id/parameters/:parameterId',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const connectorId = ctx.params['id'] as string;
        const parameterId = ctx.params['parameterId'] as string;
        const body = (ctx.body ?? {}) as Partial<CreateParameterBody>;

        const parameter = connectorsStore.updateParameter(connectorId, parameterId, body);
        if (!parameter) return apiError(res, 'Parameter not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_PARAMETER_UPDATED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: connectorId,
          metadata: { parameterId, event: 'updated' },
        });

        json(res, parameter);
      }
    )
  );

  router.delete(
    '/admin/connector-registry/connectors/:id/parameters/:parameterId',
    requirePermission('connector-registry.delete')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const connectorId = ctx.params['id'] as string;
        const parameterId = ctx.params['parameterId'] as string;
        const ok = connectorsStore.deleteParameter(connectorId, parameterId);
        if (!ok) return apiError(res, 'Parameter not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_PARAMETER_DELETED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: connectorId,
          metadata: { parameterId },
        });

        json(res, { deleted: true });
      }
    )
  );
}
