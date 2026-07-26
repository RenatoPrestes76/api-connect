import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { connectorInstallationStore } from '../../../modules/connector-management/connector-installation-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type { AssignConnectorError } from '../../../modules/connector-management/types.js';

interface AssignConnectorBody {
  runtimeId?: string;
  connectorId?: string;
  version?: string;
}

const ERROR_STATUS: Record<AssignConnectorError, { status: number; message: string }> = {
  RUNTIME_NOT_FOUND: { status: 404, message: 'Runtime not found' },
  CONNECTOR_NOT_FOUND: { status: 404, message: 'Connector not found' },
  VERSION_NOT_FOUND: { status: 404, message: 'No matching connector version found' },
  INCOMPATIBLE_RUNTIME_VERSION: {
    status: 409,
    message:
      "The connector version's minimum runtime version is higher than the target Runtime's version",
  },
  INVALID_PACKAGE_SIGNATURE: {
    status: 409,
    message:
      'Connector package signature is missing or invalid — refusing to assign an unsigned/tampered package',
  },
  ALREADY_ASSIGNED: { status: 409, message: 'This connector is already assigned to this Runtime' },
};

export function registerConnectorAssignRoute(router: Router): void {
  router.post(
    '/connectors/assign',
    requirePermission('connector-management.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body as AssignConnectorBody | undefined) ?? {};
        const { runtimeId, connectorId, version } = body;
        if (!runtimeId || !connectorId) {
          return apiError(res, 'runtimeId and connectorId are required', 422, 'VALIDATION_ERROR');
        }

        const result = connectorInstallationStore.assignConnector(runtimeId, connectorId, version);
        if (!result.ok) {
          const mapped = ERROR_STATUS[result.error];
          return apiError(res, mapped.message, mapped.status, result.error);
        }

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_ASSIGNED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: result.installation.id,
          metadata: { runtimeId, connectorId, version: result.installation.installedVersion },
        });
        json(res, { installation: connectorInstallationStore.toDTO(result.installation) }, 201);
      }
    )
  );
}
