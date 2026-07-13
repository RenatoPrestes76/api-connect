/**
 * Agent auth middleware — validates Atlas Agent Access Tokens (aat_...).
 * Sets ctx.agentId on success.
 * Only applied to AGENT_PROTECTED_PATHS; all other paths pass through.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Middleware, RouteContext } from '../http/router.js';
import { apiError } from '../http/router.js';
import { hashAgentToken } from '@seltriva/agent-provisioning';
import type { AgentAccessTokenRepository } from '@seltriva/agent-provisioning';

const AGENT_PROTECTED_PATHS = new Set(['/api/v1/heartbeat', '/api/v1/sync-status', '/api/v1/me']);

export function createAgentAuthMiddleware(repo: AgentAccessTokenRepository): Middleware {
  return async (
    ctx: RouteContext,
    _req: IncomingMessage,
    res: ServerResponse,
    next: () => Promise<void>
  ): Promise<void> => {
    if (!AGENT_PROTECTED_PATHS.has(ctx.pathname)) {
      return next();
    }

    const authHeader = ctx.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer aat_')) {
      apiError(res, 'Missing or invalid agent token', 401, 'UNAUTHORIZED');
      return;
    }

    const rawToken = authHeader.slice(7);
    const hash = hashAgentToken(rawToken);
    const token = await repo.findByHash(hash);

    if (!token || !token.isValid()) {
      apiError(res, 'Invalid or expired agent token', 401, 'INVALID_TOKEN');
      return;
    }

    ctx.agentId = token.agentId;
    await repo.updateLastUsed(token.id, new Date());
    return next();
  };
}
