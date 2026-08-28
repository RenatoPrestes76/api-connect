import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireRuntimeAuth } from '../../../middleware/runtime-auth.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import { verifyRequestSignature } from '../../../modules/runtime-registration/signature.js';
import {
  canonicalHealthReportPayload,
  canonicalDiagnosticsReportPayload,
} from '../../../modules/erp-connectivity/signature.js';
import { erpConnectivityStore } from '../../../modules/erp-connectivity/erp-connectivity-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type {
  ReportHealthInput,
  ReportDiagnosticsInput,
} from '../../../modules/erp-connectivity/types.js';

const REPLAY_TOLERANCE_MS = 5 * 60_000;

async function verifySignedRuntimeRequest(
  runtimeId: string,
  timestamp: string,
  signature: string,
  payload: string
): Promise<{ ok: true } | { ok: false; status: number; message: string; code: string }> {
  const runtime = await runtimeRegistrationStore.getRuntime(runtimeId);
  if (!runtime) return { ok: false, status: 404, message: 'Runtime not found', code: 'NOT_FOUND' };
  if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
    return {
      ok: false,
      status: 403,
      message: `Runtime is ${runtime.status.toLowerCase()}`,
      code: 'RUNTIME_NOT_ACTIVE',
    };
  }
  const timestampMs = new Date(timestamp).getTime();
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > REPLAY_TOLERANCE_MS) {
    return {
      ok: false,
      status: 401,
      message: 'Timestamp outside acceptable window',
      code: 'REPLAY_REJECTED',
    };
  }
  if (!verifyRequestSignature(payload, signature, runtime.publicKey)) {
    return {
      ok: false,
      status: 401,
      message: 'Invalid request signature',
      code: 'INVALID_SIGNATURE',
    };
  }
  return { ok: true };
}

export function registerErpConnectivityRuntimeRoutes(router: Router): void {
  // ─── GET /erp-connectivity/runtime/profiles ─────────────────────────────
  // JWT self-service fetch (Sprint 46.7's requireRuntimeAuth) — the one place
  // the decrypted credential crosses the wire, over the Runtime's own
  // authenticated session.
  router.get(
    '/erp-connectivity/runtime/profiles',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const profiles = erpConnectivityStore.listProfiles({ runtimeId: ctx.runtimeId });
      json(res, {
        total: profiles.length,
        profiles: profiles.map((p) => erpConnectivityStore.toRuntimeDTO(p)),
      });
    })
  );

  // ─── POST /erp-connectivity/health-report ───────────────────────────────
  router.post('/erp-connectivity/health-report', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as Partial<ReportHealthInput> | undefined) ?? {};
    const { profileId, runtimeId, success, timestamp, signature } = body;
    if (!profileId || !runtimeId || success === undefined || !timestamp || !signature) {
      return apiError(
        res,
        'profileId, runtimeId, success, timestamp, and signature are required',
        422,
        'VALIDATION_ERROR'
      );
    }
    if (erpConnectivityStore.isReplayedHealthSignature(profileId, signature)) {
      return apiError(
        res,
        'This exact health report was already processed',
        401,
        'REPLAY_REJECTED'
      );
    }

    const payload = canonicalHealthReportPayload(body as ReportHealthInput);
    const verified = await verifySignedRuntimeRequest(runtimeId, timestamp, signature, payload);
    if (!verified.ok) {
      return apiError(res, verified.message, verified.status, verified.code);
    }

    const result = await erpConnectivityStore.reportHealth(body as ReportHealthInput);
    if (!result.ok) {
      const status = result.error === 'PROFILE_NOT_FOUND' ? 404 : 409;
      return apiError(res, `Health report rejected: ${result.error}`, status, result.error);
    }

    if (result.reconnected) {
      adminIdentityStore.recordAudit({
        action: 'CONNECTION_RECONNECTED',
        actorEmail: 'runtime-installer@system',
        target: profileId,
        metadata: { runtimeId },
      });
    }
    json(res, { health: result.health, reconnected: result.reconnected });
  });

  // ─── POST /erp-connectivity/diagnostics-report ──────────────────────────
  router.post(
    '/erp-connectivity/diagnostics-report',
    async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as Partial<ReportDiagnosticsInput> | undefined) ?? {};
      const {
        profileId,
        runtimeId,
        dns,
        tcp,
        authentication,
        database,
        permissions,
        driver,
        encryption,
        timestamp,
        signature,
      } = body;
      if (
        !profileId ||
        !runtimeId ||
        !dns ||
        !tcp ||
        !authentication ||
        !database ||
        !permissions ||
        !driver ||
        !encryption ||
        !timestamp ||
        !signature
      ) {
        return apiError(res, 'All diagnostic check fields are required', 422, 'VALIDATION_ERROR');
      }
      if (erpConnectivityStore.isReplayedDiagnosticsSignature(profileId, signature)) {
        return apiError(
          res,
          'This exact diagnostics report was already processed',
          401,
          'REPLAY_REJECTED'
        );
      }

      const payload = canonicalDiagnosticsReportPayload(body as ReportDiagnosticsInput);
      const verified = await verifySignedRuntimeRequest(runtimeId, timestamp, signature, payload);
      if (!verified.ok) {
        return apiError(res, verified.message, verified.status, verified.code);
      }

      const result = erpConnectivityStore.reportDiagnostics(body as ReportDiagnosticsInput);
      if (!result.ok) {
        const status = result.error === 'PROFILE_NOT_FOUND' ? 404 : 409;
        return apiError(res, `Diagnostics report rejected: ${result.error}`, status, result.error);
      }

      if (authentication === 'FAIL') {
        adminIdentityStore.recordAudit({
          action: 'CONNECTION_AUTH_FAILED',
          actorEmail: 'runtime-installer@system',
          target: profileId,
          metadata: { runtimeId },
        });
      }
      json(res, { report: result.report });
    }
  );
}
