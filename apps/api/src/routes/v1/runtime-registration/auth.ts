import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import {
  verifyRequestSignature,
  canonicalAuthTokenPayload,
} from '../../../modules/runtime-registration/signature.js';
import {
  signRuntimeAccessToken,
  generateRuntimeRefreshToken,
  RUNTIME_ACCESS_TOKEN_TTL_SECONDS,
  RUNTIME_REFRESH_TOKEN_TTL_SECONDS,
} from '../../../modules/runtime-registration/runtime-jwt.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { parseBody } from '../../../http/validation.js';
import { RuntimeAuthTokenBodySchema, RuntimeRefreshTokenBodySchema } from './schemas.js';

const REPLAY_TOLERANCE_MS = 5 * 60_000;

/**
 * JWT session auth for Runtimes — a second, parallel auth mode alongside
 * Ed25519 per-request signing. A Runtime proves its identity once (signed,
 * like heartbeat) to obtain a session, then uses the access token as a
 * plain Bearer token for self-service endpoints instead of re-signing every
 * request.
 */
export function registerRuntimeAuthRoutes(router: Router): void {
  // ─── POST /runtime/auth/token ───────────────────────────────────────────
  router.post('/runtime/auth/token', async (ctx: RouteContext, res: ServerResponse) => {
    const body = parseBody(RuntimeAuthTokenBodySchema, ctx, res);
    if (!body) return;
    const { runtimeId, timestamp, signature } = body;

    const runtime = await runtimeRegistrationStore.getRuntime(runtimeId);
    if (!runtime) return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
    if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
      return apiError(res, `Runtime is ${runtime.status.toLowerCase()}`, 403, 'RUNTIME_NOT_ACTIVE');
    }

    const timestampMs = new Date(timestamp).getTime();
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > REPLAY_TOLERANCE_MS) {
      return apiError(res, 'Timestamp outside acceptable window', 401, 'REPLAY_REJECTED');
    }

    const payload = canonicalAuthTokenPayload({ runtimeId, timestamp });
    if (!verifyRequestSignature(payload, signature, runtime.publicKey)) {
      return apiError(res, 'Invalid request signature', 401, 'INVALID_SIGNATURE');
    }

    const refreshToken = generateRuntimeRefreshToken();
    runtimeRegistrationStore.createRuntimeSession(
      runtime.id,
      refreshToken,
      RUNTIME_REFRESH_TOKEN_TTL_SECONDS
    );
    const accessToken = await signRuntimeAccessToken({
      runtimeId: runtime.id,
      organizationId: runtime.organizationId,
    });

    adminIdentityStore.recordAudit({
      action: 'RUNTIME_LOGIN',
      actorEmail: 'runtime-installer@system',
      target: runtime.id,
      metadata: { organizationId: runtime.organizationId },
    });
    json(res, { accessToken, refreshToken, expiresIn: RUNTIME_ACCESS_TOKEN_TTL_SECONDS });
  });

  // ─── POST /runtime/auth/refresh ─────────────────────────────────────────
  router.post('/runtime/auth/refresh', async (ctx: RouteContext, res: ServerResponse) => {
    const body = parseBody(RuntimeRefreshTokenBodySchema, ctx, res);
    if (!body) return;

    const session = runtimeRegistrationStore.findActiveRuntimeSession(body.refreshToken);
    if (!session) {
      return apiError(res, 'Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
    const runtime = await runtimeRegistrationStore.getRuntime(session.runtimeId);
    if (!runtime || runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
      return apiError(res, 'Runtime session is no longer valid', 401, 'SESSION_REVOKED');
    }

    // Rotate: revoke the old session, issue a fresh refresh token + session.
    runtimeRegistrationStore.revokeRuntimeSession(session.id);
    const newRefreshToken = generateRuntimeRefreshToken();
    runtimeRegistrationStore.createRuntimeSession(
      runtime.id,
      newRefreshToken,
      RUNTIME_REFRESH_TOKEN_TTL_SECONDS
    );
    const accessToken = await signRuntimeAccessToken({
      runtimeId: runtime.id,
      organizationId: runtime.organizationId,
    });

    adminIdentityStore.recordAudit({
      action: 'RUNTIME_TOKEN_ROTATED',
      actorEmail: 'runtime-installer@system',
      target: runtime.id,
    });
    json(res, {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: RUNTIME_ACCESS_TOKEN_TTL_SECONDS,
    });
  });

  // ─── POST /runtime/auth/revoke ──────────────────────────────────────────
  router.post('/runtime/auth/revoke', async (ctx: RouteContext, res: ServerResponse) => {
    const body = parseBody(RuntimeRefreshTokenBodySchema, ctx, res);
    if (!body) return;

    const session = runtimeRegistrationStore.findActiveRuntimeSession(body.refreshToken);
    const revoked = runtimeRegistrationStore.revokeRuntimeSessionByRefreshToken(body.refreshToken);

    if (session) {
      adminIdentityStore.recordAudit({
        action: 'RUNTIME_LOGOUT',
        actorEmail: 'runtime-installer@system',
        target: session.runtimeId,
      });
    }
    json(res, { revoked });
  });
}
