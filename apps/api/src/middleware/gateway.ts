/**
 * Global gateway middleware (Sprint 46.5): rate limiting + centralized
 * request logging for the tenant self-service portal surface
 * (/api/v1/portal/*). Runs once per request in the global chain (see
 * server.ts) rather than per-route, so every portal route gets both for
 * free — including the new API-key auth path.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Middleware, RouteContext } from '../http/router.js';
import { apiError } from '../http/router.js';
import { resolvePortalIdentity } from '../modules/gateway/resolve-identity.js';
import { gatewayStore } from '../modules/gateway/gateway-store.js';

const PORTAL_PREFIX = '/api/v1/portal/';
/** The gateway's own control-plane (API keys, rate limits, settings, logs)
 * is exempt from rate limiting — it's config/management traffic, not the
 * platform API usage the limits exist to protect. Still logged. */
const GATEWAY_ADMIN_PREFIX = '/api/v1/portal/gateway/';

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
}

export const gatewayMiddleware: Middleware = async (
  ctx: RouteContext,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
) => {
  if (!ctx.pathname.startsWith(PORTAL_PREFIX)) {
    return next();
  }

  const start = Date.now();
  const identity = await resolvePortalIdentity(ctx);
  if (identity) {
    ctx.portalUserId = identity.actorId;
    ctx.portalOrganizationId = identity.organizationId;
    ctx.portalRole = identity.role;
    ctx.portalEmail = identity.actorLabel;
    ctx.portalPermissions = identity.permissions;
  }

  if (identity && !ctx.pathname.startsWith(GATEWAY_ADMIN_PREFIX)) {
    const limit = gatewayStore.checkRateLimit(identity.organizationId);
    if (limit.exceeded) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(((limit.resetAt ?? Date.now()) - Date.now()) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('X-RateLimit-Limit', String(limit.limit ?? 0));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(limit.resetAt ?? Date.now()));
      apiError(
        res,
        `Rate limit exceeded (${limit.window}): ${limit.limit} requests`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
      logRequest(ctx, req, identity, res.statusCode, Date.now() - start);
      return;
    }
  }

  try {
    await next();
  } finally {
    logRequest(ctx, req, identity, res.statusCode, Date.now() - start);
  }
};

function logRequest(
  ctx: RouteContext,
  req: IncomingMessage,
  identity: Awaited<ReturnType<typeof resolvePortalIdentity>>,
  statusCode: number,
  responseTimeMs: number
): void {
  gatewayStore.recordLog({
    organizationId: identity?.organizationId ?? null,
    endpoint: ctx.pathname,
    method: req.method ?? 'GET',
    actorType: identity?.actorType ?? 'anonymous',
    actorId: identity?.actorId,
    actorLabel: identity?.actorLabel ?? 'anonymous',
    ip: clientIp(req),
    statusCode,
    responseTimeMs,
  });
}
