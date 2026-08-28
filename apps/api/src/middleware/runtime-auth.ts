/**
 * Runtime JWT session auth guard — a composable route wrapper (opt-in per
 * route via requireRuntimeAuth()), mirroring middleware/admin-auth.ts's
 * shape. This is a second, parallel auth mode alongside Ed25519 per-request
 * signing (runtime-registration/signature.ts): existing signature-verified
 * endpoints (heartbeat, job/message polling) are untouched.
 */
import type { RouteContext, RouteHandler } from '../http/router.js';
import { apiError } from '../http/router.js';
import { verifyRuntimeAccessToken } from '../modules/runtime-registration/runtime-jwt.js';
import { runtimeRegistrationStore } from '../modules/runtime-registration/runtime-registration-store.js';

function extractBearerToken(ctx: RouteContext): string | null {
  const header = ctx.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7);
}

export function requireRuntimeAuth(handler: RouteHandler): RouteHandler {
  return async (ctx, res) => {
    const token = extractBearerToken(ctx);
    if (!token) {
      return apiError(res, 'Missing Runtime session token', 401, 'UNAUTHENTICATED');
    }
    const payload = await verifyRuntimeAccessToken(token);
    if (!payload) {
      return apiError(res, 'Invalid or expired Runtime session', 401, 'INVALID_SESSION');
    }

    const runtime = await runtimeRegistrationStore.getRuntime(payload.sub);
    if (!runtime || runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
      return apiError(res, 'Runtime session is no longer valid', 401, 'SESSION_REVOKED');
    }

    ctx.runtimeId = runtime.id;
    ctx.runtimeOrganizationId = runtime.organizationId;
    return handler(ctx, res);
  };
}
