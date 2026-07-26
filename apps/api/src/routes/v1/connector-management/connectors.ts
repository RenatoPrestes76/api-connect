import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { connectorsStore } from '../../../modules/connectors/connectors-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type {
  ConnectorCategory,
  ConnectorStatus,
  ConnectorVersionStatus,
} from '../../../modules/connectors/types.js';

interface CreateConnectorBody {
  identifier?: string;
  name?: string;
  category?: ConnectorCategory;
  vendor?: string;
  description?: string;
  icon?: string;
  minRuntimeVersion?: string;
}

interface PublishVersionBody {
  connectorId?: string;
  version?: string;
  changelog?: string;
  status?: ConnectorVersionStatus;
  minRuntimeVersion?: string;
  dependencies?: string[];
}

/**
 * Sprint 46.4 — thin pass-through onto the existing Connector Registry
 * (Sprint 46.6, apps/api/src/modules/connectors) at the plain paths this
 * sprint's spec asks for. Deliberately does not duplicate registry logic —
 * /admin/connector-registry/* (staff UI) keeps working unchanged.
 */
export function registerConnectorManagementCatalogRoutes(router: Router): void {
  router.get(
    '/connectors',
    requirePermission('connector-management.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const category = (ctx.query.get('category') as ConnectorCategory | null) ?? undefined;
        const status = (ctx.query.get('status') as ConnectorStatus | null) ?? undefined;
        const connectors = connectorsStore.listConnectors({ category, status });
        json(res, { total: connectors.length, connectors });
      }
    )
  );

  router.post(
    '/connectors',
    requirePermission('connector-management.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body as CreateConnectorBody | undefined) ?? {};
        const { identifier, name, category, vendor, description, icon, minRuntimeVersion } = body;
        if (!identifier || !name || !category || !vendor || !description || !minRuntimeVersion) {
          return apiError(
            res,
            'identifier, name, category, vendor, description, minRuntimeVersion are required',
            422,
            'VALIDATION_ERROR'
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
            `identifier "${identifier}" is already in use`,
            409,
            'IDENTIFIER_TAKEN'
          );
        }
        json(res, { connector: result }, 201);
      }
    )
  );

  router.post(
    '/connectors/publish',
    requirePermission('connector-management.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body as PublishVersionBody | undefined) ?? {};
        const { connectorId, version, changelog, status, minRuntimeVersion, dependencies } = body;
        if (!connectorId || !version || !status || !minRuntimeVersion) {
          return apiError(
            res,
            'connectorId, version, status, minRuntimeVersion are required',
            422,
            'VALIDATION_ERROR'
          );
        }
        const result = connectorsStore.publishVersion(connectorId, {
          version,
          changelog: changelog ?? '',
          status,
          minRuntimeVersion,
          dependencies: dependencies ?? [],
        });
        if (!result) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_VERSION_PUBLISHED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: connectorId,
          metadata: { version, checksum: result.checksum },
        });
        json(res, { version: result }, 201);
      }
    )
  );
}
