import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type {
  RuntimeConfigPatch,
  RuntimeStatus,
} from '../../../modules/runtime-registration/types.js';

export function registerRuntimeRegistrationAdminRoutes(router: Router): void {
  // ─── GET /admin/runtime-registration/runtimes ──────────────────────────
  router.get(
    '/admin/runtime-registration/runtimes',
    requirePermission('runtime-registration.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const organizationId = ctx.query.get('organizationId') ?? undefined;
        const status = (ctx.query.get('status') as RuntimeStatus | null) ?? undefined;
        const runtimes = runtimeRegistrationStore.listRuntimes({ organizationId, status });
        json(res, {
          total: runtimes.length,
          runtimes: runtimes.map((r) => runtimeRegistrationStore.toDTO(r)),
        });
      }
    )
  );

  // ─── GET /admin/runtime-registration/runtimes/:id ──────────────────────
  router.get(
    '/admin/runtime-registration/runtimes/:id',
    requirePermission('runtime-registration.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const runtime = runtimeRegistrationStore.getRuntime(ctx.params['id'] as string);
        if (!runtime) return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
        const certificate = runtimeRegistrationStore.getCertificate(runtime.id);
        json(res, {
          runtime: runtimeRegistrationStore.toDTO(runtime),
          certificate: certificate
            ? {
                certificateId: certificate.certificateId,
                issuedAt: certificate.issuedAt,
                expiresAt: certificate.expiresAt,
                revoked: certificate.revoked,
                revokedAt: certificate.revokedAt,
              }
            : null,
        });
      }
    )
  );

  // ─── POST /admin/runtime-registration/runtimes/:id/block ───────────────
  router.post(
    '/admin/runtime-registration/runtimes/:id/block',
    requirePermission('runtime-registration.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const runtime = runtimeRegistrationStore.blockRuntime(ctx.params['id'] as string);
        if (!runtime) return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
        adminIdentityStore.recordAudit({
          action: 'RUNTIME_BLOCKED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: runtime.id,
        });
        json(res, { runtime: runtimeRegistrationStore.toDTO(runtime) });
      }
    )
  );

  // ─── POST /admin/runtime-registration/runtimes/:id/reactivate ──────────
  router.post(
    '/admin/runtime-registration/runtimes/:id/reactivate',
    requirePermission('runtime-registration.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const runtime = runtimeRegistrationStore.reactivateRuntime(ctx.params['id'] as string);
        if (!runtime) {
          return apiError(res, 'Runtime not found or not blocked', 409, 'INVALID_STATE');
        }
        adminIdentityStore.recordAudit({
          action: 'RUNTIME_REACTIVATED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: runtime.id,
        });
        json(res, { runtime: runtimeRegistrationStore.toDTO(runtime) });
      }
    )
  );

  // ─── DELETE /admin/runtime-registration/runtimes/:id/credentials ───────
  router.delete(
    '/admin/runtime-registration/runtimes/:id/credentials',
    requirePermission('runtime-registration.delete')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const cert = runtimeRegistrationStore.revokeCertificate(ctx.params['id'] as string);
        if (!cert) {
          return apiError(
            res,
            'Runtime not found or certificate already revoked',
            409,
            'INVALID_STATE'
          );
        }
        adminIdentityStore.recordAudit({
          action: 'RUNTIME_CERTIFICATE_REVOKED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: cert.runtimeId,
        });
        json(res, { revoked: true, runtimeId: cert.runtimeId });
      }
    )
  );

  // ─── POST /admin/runtime-registration/activation-keys ──────────────────
  router.post(
    '/admin/runtime-registration/activation-keys',
    requirePermission('runtime-registration.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = ctx.body as { organizationCode?: string } | undefined;
        const organizationCode = body?.organizationCode?.trim();
        if (!organizationCode) {
          return apiError(res, 'organizationCode is required', 422, 'VALIDATION_ERROR');
        }
        const org = portalIdentityStore.findOrganizationByCode(organizationCode);
        if (!org) return apiError(res, 'Organization not found', 404, 'NOT_FOUND');

        const key = runtimeRegistrationStore.issueActivationKey(org.id, org.internalCode);
        adminIdentityStore.recordAudit({
          action: 'RUNTIME_ACTIVATION_KEY_ISSUED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: key.id,
          metadata: { organizationId: org.id },
        });
        json(res, { activationKey: key }, 201);
      }
    )
  );

  // ─── GET /admin/runtime-registration/activation-keys ───────────────────
  router.get(
    '/admin/runtime-registration/activation-keys',
    requirePermission('runtime-registration.read')(
      async (_ctx: RouteContext, res: ServerResponse) => {
        const keys = runtimeRegistrationStore.listActivationKeys();
        json(res, { total: keys.length, activationKeys: keys });
      }
    )
  );

  // ─── DELETE /admin/runtime-registration/activation-keys/:id ────────────
  // Invalidates a not-yet-consumed activation key (e.g. it leaked before the
  // Runtime ever used it). Mirrors the credentials-revocation endpoint above.
  router.delete(
    '/admin/runtime-registration/activation-keys/:id',
    requirePermission('runtime-registration.delete')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const key = runtimeRegistrationStore.revokeActivationKey(ctx.params['id'] as string);
        if (!key) {
          return apiError(
            res,
            'Activation key not found, or already used/revoked',
            409,
            'INVALID_STATE'
          );
        }
        adminIdentityStore.recordAudit({
          action: 'RUNTIME_ACTIVATION_KEY_REVOKED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: key.id,
          metadata: { organizationId: key.organizationId },
        });
        json(res, { activationKey: key });
      }
    )
  );

  // ─── GET /admin/runtime-registration/runtimes/:id/config ───────────────
  router.get(
    '/admin/runtime-registration/runtimes/:id/config',
    requirePermission('runtime-registration.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const runtimeId = ctx.params['id'] as string;
        if (!runtimeRegistrationStore.getRuntime(runtimeId)) {
          return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
        }
        const config = runtimeRegistrationStore.getRuntimeConfig(runtimeId);
        if (!config) return apiError(res, 'Runtime config not found', 404, 'NOT_FOUND');
        json(res, { config });
      }
    )
  );

  // ─── PATCH /admin/runtime-registration/runtimes/:id/config ─────────────
  router.patch(
    '/admin/runtime-registration/runtimes/:id/config',
    requirePermission('runtime-registration.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const runtimeId = ctx.params['id'] as string;
        if (!runtimeRegistrationStore.getRuntime(runtimeId)) {
          return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
        }
        const patch = (ctx.body as RuntimeConfigPatch | undefined) ?? {};
        const config = runtimeRegistrationStore.updateRuntimeConfig(runtimeId, patch);
        if (!config) return apiError(res, 'Runtime config not found', 404, 'NOT_FOUND');

        adminIdentityStore.recordAudit({
          action: 'RUNTIME_CONFIG_UPDATED',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: runtimeId,
          metadata: { patch },
        });
        json(res, { config });
      }
    )
  );
}
