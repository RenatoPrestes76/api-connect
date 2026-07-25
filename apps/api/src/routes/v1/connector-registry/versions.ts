import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { connectorsStore } from '../../../modules/connectors/connectors-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { ConnectorVersionStatus } from '../../../modules/connectors/types.js';

interface PublishVersionBody {
  version?: string;
  changelog?: string;
  status?: ConnectorVersionStatus;
  minRuntimeVersion?: string;
  dependencies?: string[];
}

export function registerConnectorVersionRoutes(router: Router): void {
  router.get(
    '/admin/connector-registry/connectors/:id/versions',
    requirePermission('connector-registry.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const connectorId = ctx.params['id'] as string;
      if (!connectorsStore.getConnector(connectorId)) {
        return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
      }
      const versions = connectorsStore.listVersions(connectorId);
      json(res, { total: versions.length, versions });
    })
  );

  router.post(
    '/admin/connector-registry/connectors/:id/versions',
    requirePermission('connector-registry.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const connectorId = ctx.params['id'] as string;
        const body = (ctx.body ?? {}) as PublishVersionBody;
        const { version, changelog, status, minRuntimeVersion, dependencies } = body;

        if (!version || !changelog || !minRuntimeVersion) {
          return apiError(
            res,
            'version, changelog and minRuntimeVersion are required',
            400,
            'MISSING_FIELDS'
          );
        }
        const versionStatus: ConnectorVersionStatus = status === 'beta' ? 'beta' : 'stable';

        const result = connectorsStore.publishVersion(connectorId, {
          version,
          changelog,
          status: versionStatus,
          minRuntimeVersion,
          dependencies: dependencies ?? [],
        });
        if (!result) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_VERSION_PUBLISHED',
          actorId: ctx.adminUserId,
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: connectorId,
          metadata: { version: result.version, status: result.status },
        });

        json(res, result, 201);
      }
    )
  );
}
