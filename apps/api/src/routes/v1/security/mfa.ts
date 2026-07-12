import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { securityStore } from '../../../modules/security/security-store.js';
import {
  generateTotpSecret,
  generateBackupCodes,
  verifyTotpToken,
  buildOtpUri,
  base32Decode,
} from '@seltriva/aegis';

function resolveTenant(ctx: RouteContext): string {
  return (ctx.headers['x-tenant-id'] as string) || ctx.query.get('tenantId') || 'tenant-enterprise';
}

export function registerMfaRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  // GET /api/v1/security/mfa/status
  router.get('/api/v1/security/mfa/status', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const userId = ctx.query.get('userId') || `admin@atlas.${tenantId.replace('tenant-', '')}.com`;
    const rec = securityStore.getMfaRecord(tenantId, userId);
    if (!rec) return json(res, { enrolled: false, userId, tenantId });
    const { secretBase32: _, backupCodes: __, ...safe } = rec;
    json(res, {
      ...safe,
      backupCodesRemaining: rec.backupCodes.length - rec.usedBackupCodes.length,
    });
  });

  // POST /api/v1/security/mfa/setup
  router.post('/api/v1/security/mfa/setup', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const body = ctx.body as Record<string, unknown>;
    const userId =
      (body?.['userId'] as string) || `admin@atlas.${tenantId.replace('tenant-', '')}.com`;
    const secretBase32 = generateTotpSecret();
    const backupCodes = generateBackupCodes(8);
    const otpUri = buildOtpUri('Atlas Connect', userId, secretBase32);
    const now = new Date().toISOString();
    const existing = securityStore.getMfaRecord(tenantId, userId);
    securityStore.upsertMfaRecord({
      tenantId,
      userId,
      enrolled: true,
      secretBase32,
      backupCodes,
      usedBackupCodes: [],
      trustedDevices: existing?.trustedDevices ?? [],
      enrolledAt: now,
      lastUsedAt: null,
    });
    json(
      res,
      {
        secret: secretBase32,
        otpUri,
        backupCodes,
        qrData: `data:text/plain,${encodeURIComponent(otpUri)}`,
      },
      201
    );
  });

  // POST /api/v1/security/mfa/verify
  router.post('/api/v1/security/mfa/verify', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const body = ctx.body as Record<string, unknown>;
    const userId = body?.['userId'] as string;
    const token = body?.['token'] as string;
    if (!userId || !token) return apiError(res, 'userId and token required', 400);
    const rec = securityStore.getMfaRecord(tenantId, userId);
    if (!rec || !rec.enrolled) return apiError(res, 'MFA not enrolled', 404);
    const secretBuf = base32Decode(rec.secretBase32);
    const valid = verifyTotpToken(secretBuf, String(token));
    if (!valid) return json(res, { valid: false, message: 'Invalid or expired token' });
    securityStore.upsertMfaRecord({ ...rec, lastUsedAt: new Date().toISOString() });
    json(res, { valid: true });
  });

  // DELETE /api/v1/security/mfa/disable  (userId as query param)
  router.delete('/api/v1/security/mfa/disable', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const userId = ctx.query.get('userId') || `admin@atlas.${tenantId.replace('tenant-', '')}.com`;
    const rec = securityStore.getMfaRecord(tenantId, userId);
    if (!rec) return apiError(res, 'MFA record not found', 404);
    securityStore.upsertMfaRecord({
      ...rec,
      enrolled: false,
      secretBase32: '',
      backupCodes: [],
      enrolledAt: null,
    });
    json(res, { disabled: true, userId });
  });

  // GET /api/v1/security/mfa/backup-codes
  router.get(
    '/api/v1/security/mfa/backup-codes',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = resolveTenant(ctx);
      const userId =
        ctx.query.get('userId') || `admin@atlas.${tenantId.replace('tenant-', '')}.com`;
      const rec = securityStore.getMfaRecord(tenantId, userId);
      if (!rec || !rec.enrolled) return apiError(res, 'MFA not enrolled', 404);
      const remaining = rec.backupCodes.filter((c) => !rec.usedBackupCodes.includes(c));
      json(res, { remaining: remaining.length, codes: remaining });
    }
  );
}
