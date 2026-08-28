import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { erpConnectivityStore } from '../../../modules/erp-connectivity/erp-connectivity-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import {
  isSupportedDbType,
  listSupportedDrivers,
} from '../../../modules/erp-connectivity/drivers.js';
import type { CreateProfileError, DbType } from '../../../modules/erp-connectivity/types.js';
import { parseBody, parseQuery } from '../../../http/validation.js';
import {
  CreateProfileBodySchema,
  UpdateProfileBodySchema,
  ListProfilesQuerySchema,
} from './schemas.js';

const CREATE_ERROR_STATUS: Record<CreateProfileError, { status: number; message: string }> = {
  RUNTIME_NOT_FOUND: { status: 404, message: 'Runtime not found' },
  RUNTIME_ORGANIZATION_MISMATCH: {
    status: 403,
    message: 'This Runtime does not belong to the given organizationId',
  },
};

export function registerErpConnectivityProfileRoutes(router: Router): void {
  // ─── GET /erp-connectivity/drivers ──────────────────────────────────────
  router.get(
    '/erp-connectivity/drivers',
    requirePermission('erp-connectivity.read')(async (_ctx: RouteContext, res: ServerResponse) => {
      json(res, { drivers: listSupportedDrivers() });
    })
  );

  // ─── POST /erp-connectivity/profiles ─────────────────────────────────────
  router.post(
    '/erp-connectivity/profiles',
    requirePermission('erp-connectivity.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = parseBody(CreateProfileBodySchema, ctx, res);
      if (!body) return;
      const { runtimeId, organizationId, name, dbType, host, port, database, username, password } =
        body;
      if (!isSupportedDbType(dbType)) {
        return apiError(res, `Unsupported dbType: ${dbType}`, 422, 'UNSUPPORTED_DB_TYPE');
      }

      const result = await erpConnectivityStore.createProfile({
        runtimeId,
        organizationId,
        name,
        erpName: body.erpName,
        dbType: dbType as DbType,
        host,
        port,
        database,
        username,
        password,
        additionalParams: body.additionalParams,
      });
      if (!result.ok) {
        const mapped = CREATE_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'CONNECTION_PROFILE_CREATED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.profile.id,
        metadata: { runtimeId, organizationId, dbType, host, database },
      });
      json(res, { profile: erpConnectivityStore.toDTO(result.profile) }, 201);
    })
  );

  // ─── GET /erp-connectivity/profiles ──────────────────────────────────────
  router.get(
    '/erp-connectivity/profiles',
    requirePermission('erp-connectivity.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const query = parseQuery(ListProfilesQuerySchema, ctx, res);
      if (!query) return;
      const profiles = erpConnectivityStore.listProfiles(query);
      json(res, {
        total: profiles.length,
        profiles: profiles.map((p) => erpConnectivityStore.toDTO(p)),
      });
    })
  );

  // ─── GET /erp-connectivity/profiles/:id ──────────────────────────────────
  router.get(
    '/erp-connectivity/profiles/:id',
    requirePermission('erp-connectivity.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const profile = erpConnectivityStore.getProfile(ctx.params['id'] as string);
      if (!profile) return apiError(res, 'Connection profile not found', 404, 'NOT_FOUND');
      json(res, { profile: erpConnectivityStore.toDTO(profile) });
    })
  );

  // ─── PATCH /erp-connectivity/profiles/:id ────────────────────────────────
  router.patch(
    '/erp-connectivity/profiles/:id',
    requirePermission('erp-connectivity.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params['id'] as string;
      const patch = parseBody(UpdateProfileBodySchema, ctx, res);
      if (!patch) return;
      const result = erpConnectivityStore.updateProfile(id, patch);
      if (!result.ok) return apiError(res, 'Connection profile not found', 404, 'NOT_FOUND');

      adminIdentityStore.recordAudit({
        action: result.credentialRotated
          ? 'CONNECTION_CREDENTIAL_ROTATED'
          : 'CONNECTION_STATUS_CHANGED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { profile: erpConnectivityStore.toDTO(result.profile) });
    })
  );

  // ─── DELETE /erp-connectivity/profiles/:id ───────────────────────────────
  router.delete(
    '/erp-connectivity/profiles/:id',
    requirePermission('erp-connectivity.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params['id'] as string;
      const result = erpConnectivityStore.deleteProfile(id);
      if (!result.ok) return apiError(res, 'Connection profile not found', 404, 'NOT_FOUND');

      adminIdentityStore.recordAudit({
        action: 'CONNECTION_PROFILE_DELETED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { deleted: true, profileId: id });
    })
  );

  // ─── GET /erp-connectivity/profiles/:id/health ───────────────────────────
  router.get(
    '/erp-connectivity/profiles/:id/health',
    requirePermission('erp-connectivity.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params['id'] as string;
      if (!erpConnectivityStore.getProfile(id)) {
        return apiError(res, 'Connection profile not found', 404, 'NOT_FOUND');
      }
      const health = erpConnectivityStore.getHealth(id);
      json(res, { health: health ?? null });
    })
  );

  // ─── GET /erp-connectivity/profiles/:id/diagnostics ──────────────────────
  router.get(
    '/erp-connectivity/profiles/:id/diagnostics',
    requirePermission('erp-connectivity.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params['id'] as string;
      if (!erpConnectivityStore.getProfile(id)) {
        return apiError(res, 'Connection profile not found', 404, 'NOT_FOUND');
      }
      const report = erpConnectivityStore.getDiagnostics(id);
      json(res, { report: report ?? null });
    })
  );
}
