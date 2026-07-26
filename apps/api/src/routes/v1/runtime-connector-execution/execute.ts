import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { runtimeConnectorExecutionStore } from '../../../modules/runtime-connector-execution/runtime-connector-execution-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type { CreateExecutionError } from '../../../modules/runtime-connector-execution/types.js';

interface CreateExecutionBody {
  runtimeId?: string;
  organizationId?: string;
  connectorId?: string;
  profileId?: string;
  action?: string;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
}

const CREATE_ERROR_STATUS: Record<CreateExecutionError, { status: number; message: string }> = {
  RUNTIME_NOT_FOUND: { status: 404, message: 'Runtime not found' },
  RUNTIME_ORGANIZATION_MISMATCH: {
    status: 403,
    message: 'This Runtime does not belong to the given organizationId',
  },
  CONNECTOR_NOT_FOUND: { status: 404, message: 'Connector not found' },
  PROFILE_NOT_FOUND: { status: 404, message: 'Connection profile not found' },
  PROFILE_RUNTIME_MISMATCH: {
    status: 409,
    message: 'This connection profile does not belong to the given Runtime',
  },
};

/** POST /runtime/connectors/execute — Seltriva/Atlas requests a connector action be run on a Runtime. */
export function registerConnectorExecuteRoute(router: Router): void {
  router.post(
    '/runtime/connectors/execute',
    requirePermission('runtime-connector-execution.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body as CreateExecutionBody | undefined) ?? {};
        const { runtimeId, organizationId, connectorId, profileId, action } = body;
        if (!runtimeId || !organizationId || !connectorId || !profileId || !action) {
          return apiError(
            res,
            'runtimeId, organizationId, connectorId, profileId, and action are required',
            422,
            'VALIDATION_ERROR'
          );
        }

        const result = runtimeConnectorExecutionStore.createExecution({
          runtimeId,
          organizationId,
          connectorId,
          profileId,
          action,
          payload: body.payload,
          timeoutMs: body.timeoutMs,
          maxAttempts: body.maxAttempts,
          idempotencyKey: body.idempotencyKey,
          createdBy: ctx.adminEmail ?? 'unknown',
        });
        if (!result.ok) {
          const mapped = CREATE_ERROR_STATUS[result.error];
          return apiError(res, mapped.message, mapped.status, result.error);
        }

        adminIdentityStore.recordAudit({
          action: result.plan.status === 'REJECTED' ? 'EXECUTION_REJECTED' : 'EXECUTION_PLANNED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: result.plan.id,
          metadata: {
            runtimeId,
            connectorId,
            profileId,
            connectorAction: action,
            status: result.plan.status,
          },
        });
        json(
          res,
          { plan: runtimeConnectorExecutionStore.toDTO(result.plan) },
          result.plan.status === 'REJECTED' ? 422 : 201
        );
      }
    )
  );
}
