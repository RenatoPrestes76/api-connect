/**
 * POST /api/v1/activate
 *
 * Used by the Atlas Runtime Installer to register a new agent using a
 * human-readable Activation Token (ATLAS-XXXX-XXXX-XXXX) instead of a
 * cryptographic provisioning token.
 *
 * Flow:
 *  1. Validate the activation token (exists, not expired, not used).
 *  2. Register the AtlasAgent (derive companyId from the token).
 *  3. Issue an AgentAccessToken (the "Runtime Token" stored in runtime.json).
 *  4. Consume (mark used) the activation token — it can never be reused.
 *  5. Return the runtime credentials.
 */
import { randomBytes } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { AtlasAgent } from '@seltriva/agent-identity';
import type { AtlasAgentRepository } from '@seltriva/agent-identity';
import { AgentAccessToken } from '@seltriva/agent-provisioning';
import type { AgentAccessTokenRepository } from '@seltriva/agent-provisioning';
import { ActivationTokenService } from '@seltriva/activation';
import type { ActivationTokenRepository } from '@seltriva/activation';

const RUNTIME_TOKEN_TTL_MS = 365 * 24 * 60 * 60_000; // 1 year

export function createActivateHandler(
  activationTokenRepo: ActivationTokenRepository,
  agentRepo: AtlasAgentRepository,
  accessTokenRepo: AgentAccessTokenRepository
) {
  const activationService = new ActivationTokenService(activationTokenRepo);

  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const body = ctx.body as Record<string, unknown> | undefined;

    const activationToken = body?.['activationToken'] as string | undefined;
    const name = body?.['name'] as string | undefined;
    const hostname = body?.['hostname'] as string | undefined;
    const machineId = body?.['machineId'] as string | undefined;
    const version = body?.['version'] as string | undefined;
    const connectorType = (body?.['connectorType'] as string | undefined) ?? 'generic';

    if (!activationToken || !name || !hostname || !machineId || !version) {
      apiError(
        res,
        'activationToken, name, hostname, machineId and version are required',
        422,
        'VALIDATION_ERROR'
      );
      return;
    }

    // 1. Validate the activation token
    let tokenRecord;
    try {
      tokenRecord = await activationService.validate(activationToken);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('not found')) {
        apiError(res, 'Activation token not found', 401, 'TOKEN_NOT_FOUND');
      } else if (msg.includes('expired')) {
        apiError(res, 'Activation token has expired', 401, 'TOKEN_EXPIRED');
      } else if (msg.includes('already been used')) {
        apiError(res, 'Activation token has already been used', 409, 'TOKEN_USED');
      } else {
        apiError(res, msg, 401, 'TOKEN_INVALID');
      }
      return;
    }

    // 2. Ensure machine not already registered
    const existing = await agentRepo.findByMachineId(machineId);
    if (existing) {
      apiError(
        res,
        `Machine ${machineId} is already registered`,
        409,
        'MACHINE_ALREADY_REGISTERED'
      );
      return;
    }

    // 3. Register the agent
    let agent: AtlasAgent;
    try {
      agent = AtlasAgent.register({
        companyId: tokenRecord.companyId,
        name,
        hostname,
        machineId,
        connectorType,
        version,
      });
    } catch (err) {
      apiError(res, (err as Error).message, 422, 'VALIDATION_ERROR');
      return;
    }

    await agentRepo.save(agent);

    // 4. Issue runtime token (AgentAccessToken)
    const { token: accessToken, rawToken: runtimeToken } = AgentAccessToken.generate(
      agent.id.toString(),
      new Date(Date.now() + RUNTIME_TOKEN_TTL_MS)
    );
    await accessTokenRepo.save(accessToken);

    // 5. Consume the activation token (one-time use)
    await activationService.consume(activationToken);

    json(
      res,
      {
        data: {
          runtimeId: agent.id.toString(),
          companyId: agent.companyId,
          environment: tokenRecord.environment,
          runtimeToken,
          heartbeatUrl: '/api/v1/heartbeat',
          syncUrl: '/api/v1/sync-status',
        },
      },
      201
    );
  };
}
