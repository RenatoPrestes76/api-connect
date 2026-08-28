import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { connectorInstallationStore } from '../../../modules/connector-management/connector-installation-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type {
  UpdateConnectorError,
  RollbackError,
} from '../../../modules/connector-management/types.js';

interface UpdateBody {
  installationId?: string;
  targetVersion?: string;
}

interface RollbackBody {
  installationId?: string;
}

interface ReportOutcomeBody {
  outcome?: 'success' | 'failure';
  reason?: string;
}

const UPDATE_ERROR_STATUS: Record<UpdateConnectorError, { status: number; message: string }> = {
  INSTALLATION_NOT_FOUND: { status: 404, message: 'Installation not found' },
  VERSION_NOT_FOUND: { status: 404, message: 'No matching connector version found' },
  INCOMPATIBLE_RUNTIME_VERSION: {
    status: 409,
    message: "The target version's minimum runtime version is higher than this Runtime's version",
  },
  INVALID_PACKAGE_SIGNATURE: {
    status: 409,
    message:
      'Connector package signature is missing or invalid — refusing to apply an unsigned/tampered update',
  },
};

const ROLLBACK_ERROR_STATUS: Record<RollbackError, { status: number; message: string }> = {
  INSTALLATION_NOT_FOUND: { status: 404, message: 'Installation not found' },
  NO_PREVIOUS_VERSION: { status: 409, message: 'No previous version to roll back to' },
};

export function registerConnectorRuntimeRoutes(router: Router): void {
  // ─── GET /runtime/:id/connectors ───────────────────────────────────────
  router.get(
    '/runtime/:id/connectors',
    requirePermission('connector-management.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const installations = connectorInstallationStore.listByRuntime(ctx.params['id'] as string);
        json(res, {
          total: installations.length,
          installations: installations.map((i) => connectorInstallationStore.toDTO(i)),
        });
      }
    )
  );

  // ─── POST /runtime/:id/update ───────────────────────────────────────────
  router.post(
    '/runtime/:id/update',
    requirePermission('connector-management.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body as UpdateBody | undefined) ?? {};
        const { installationId, targetVersion } = body;
        if (!installationId || !targetVersion) {
          return apiError(
            res,
            'installationId and targetVersion are required',
            422,
            'VALIDATION_ERROR'
          );
        }

        const result = await connectorInstallationStore.requestUpdate(
          installationId,
          targetVersion
        );
        if (!result.ok) {
          const mapped = UPDATE_ERROR_STATUS[result.error];
          adminIdentityStore.recordAudit({
            action: 'CONNECTOR_UPDATE_REJECTED',
            actorEmail: ctx.adminEmail ?? 'unknown',
            target: installationId,
            metadata: { targetVersion, reason: result.error },
          });
          return apiError(res, mapped.message, mapped.status, result.error);
        }

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_UPDATE_REQUESTED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: installationId,
          metadata: { targetVersion },
        });
        json(res, { installation: connectorInstallationStore.toDTO(result.installation) });
      }
    )
  );

  // ─── POST /runtime/:id/rollback ─────────────────────────────────────────
  router.post(
    '/runtime/:id/rollback',
    requirePermission('connector-management.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body as RollbackBody | undefined) ?? {};
        const { installationId } = body;
        if (!installationId) {
          return apiError(res, 'installationId is required', 422, 'VALIDATION_ERROR');
        }

        const result = connectorInstallationStore.rollback(installationId);
        if (!result.ok) {
          const mapped = ROLLBACK_ERROR_STATUS[result.error];
          return apiError(res, mapped.message, mapped.status, result.error);
        }

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_ROLLED_BACK',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: installationId,
          metadata: { restoredVersion: result.installation.installedVersion },
        });
        json(res, { installation: connectorInstallationStore.toDTO(result.installation) });
      }
    )
  );

  // ─── POST /runtime/:id/connectors/:installationId/report ───────────────
  // Additive, not in the spec's literal endpoint list: simulates the
  // Runtime confirming an install/update outcome ("Confirma sucesso" /
  // "Falha" in the sprint's flow diagrams). On failure with a
  // previousVersion recorded, this IS the automatic rollback — no separate
  // manual step required.
  router.post(
    '/runtime/:id/connectors/:installationId/report',
    requirePermission('connector-management.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body as ReportOutcomeBody | undefined) ?? {};
        const { outcome, reason } = body;
        if (outcome !== 'success' && outcome !== 'failure') {
          return apiError(res, 'outcome must be "success" or "failure"', 422, 'VALIDATION_ERROR');
        }

        const installationId = ctx.params['installationId'] as string;
        const installation = connectorInstallationStore.reportOutcome(
          installationId,
          outcome,
          reason
        );
        if (!installation) return apiError(res, 'Installation not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'CONNECTOR_INSTALLATION_OUTCOME_REPORTED',
          actorEmail: ctx.adminEmail ?? 'runtime-installer@system',
          target: installationId,
          metadata: { outcome, reason, resultingStatus: installation.status },
        });
        json(res, { installation: connectorInstallationStore.toDTO(installation) });
      }
    )
  );
}
