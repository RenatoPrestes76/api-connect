import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import type { ProvisioningService } from '@seltriva/agent-provisioning';

export function createProvisionHandler(service: ProvisioningService) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const body = ctx.body as Record<string, unknown> | undefined;

    const rawToken = body?.['rawToken'] as string | undefined;
    const machineId = body?.['machineId'] as string | undefined;
    const hostname = body?.['hostname'] as string | undefined;
    const connectorType = body?.['connectorType'] as string | undefined;
    const version = body?.['version'] as string | undefined;
    const name = body?.['name'] as string | undefined;
    const companyId = body?.['companyId'] as string | undefined;

    if (!rawToken || !machineId || !hostname || !connectorType || !version || !name || !companyId) {
      apiError(
        res,
        'rawToken, machineId, hostname, connectorType, version, name and companyId are required',
        422,
        'VALIDATION_ERROR'
      );
      return;
    }

    const result = await service.registerAgent(rawToken, {
      companyId,
      name,
      hostname,
      machineId,
      connectorType,
      version,
    });

    if (!result.ok) {
      const { code } = result.error;
      if (code === 'TOKEN_NOT_FOUND' || code === 'TOKEN_EXPIRED' || code === 'TOKEN_REVOKED') {
        apiError(res, `Provisioning token ${code.toLowerCase().replace(/_/g, ' ')}`, 401, code);
      } else if (code === 'COMPANY_MISMATCH') {
        apiError(res, 'Token company does not match the requested company', 403, code);
      } else if (code === 'MACHINE_ALREADY_REGISTERED') {
        apiError(res, `Machine ${result.error.machineId} is already registered`, 409, code);
      } else {
        apiError(
          res,
          (result.error as { message?: string }).message ?? 'Validation failed',
          422,
          code
        );
      }
      return;
    }

    json(res, { data: { agentId: result.value.agentId, accessToken: result.value.rawToken } }, 201);
  };
}
