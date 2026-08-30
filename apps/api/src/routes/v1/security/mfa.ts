import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { mfaVerifyRateLimiter } from '../../../modules/security/rate-limiter.js';
import {
  generateTotpSecret,
  generateBackupCodes,
  verifyTotpToken,
  buildOtpUri,
  base32Decode,
} from '@seltriva/aegis';

/**
 * ATLAS 46.26 — final hardening, Part 5: audited the `admin@atlas.<tenant>.com`
 * default used below when `userId` is omitted. Verdict: safe to keep as-is.
 * It's derived from `tenantId`, which is always session-derived
 * (requireOrgId, never client-supplied) by the time this default is
 * computed — so tenant A's omitted-userId calls can only ever resolve to
 * tenant A's own default identity, never cross into tenant B's namespace.
 * Not tightened to a required-explicit-userId contract: several existing
 * demo/seed flows (and this module's own test suite) rely on the omitted-
 * userId shorthand, and no real vulnerability depends on it — changing it
 * would be an incompatible contract change with no security benefit, which
 * this sprint's own scope rules (no unnecessary contract changes) argue
 * against. See security-routes.test.ts's "MFA userId default never crosses
 * tenant boundary" test for the regression proof.
 */
export function registerMfaRoutes(router: Router): void {
  // GET /api/v1/security/mfa/status
  router.get('/api/v1/security/mfa/status', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
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
    const tenantId = requireOrgId(ctx);
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

  /**
   * ATLAS 46.26 — final hardening, Part 2: this route had no rate limiting
   * — a 6-digit TOTP is brute-forceable without one. Locked out after 5
   * failed attempts / 15 minutes, keyed by (tenantId, userId) — see
   * rate-limiter.ts's doc comment for why IP is deliberately excluded from
   * the key.
   */
  // POST /api/v1/security/mfa/verify
  router.post('/api/v1/security/mfa/verify', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const body = ctx.body as Record<string, unknown>;
    const userId = body?.['userId'] as string;
    const token = body?.['token'] as string;
    if (!userId || !token) return apiError(res, 'userId and token required', 400);

    if (mfaVerifyRateLimiter.isLocked(tenantId, userId)) {
      return apiError(
        res,
        'Too many failed MFA attempts. Try again in 15 minutes.',
        423,
        'MFA_LOCKED'
      );
    }

    const rec = securityStore.getMfaRecord(tenantId, userId);
    if (!rec || !rec.enrolled) return apiError(res, 'MFA not enrolled', 404);
    const secretBuf = base32Decode(rec.secretBase32);
    const valid = verifyTotpToken(secretBuf, String(token));
    if (!valid) {
      mfaVerifyRateLimiter.recordFailure(tenantId, userId);
      return json(res, { valid: false, message: 'Invalid or expired token' });
    }
    mfaVerifyRateLimiter.recordSuccess(tenantId, userId);
    securityStore.upsertMfaRecord({ ...rec, lastUsedAt: new Date().toISOString() });
    json(res, { valid: true });
  });

  // DELETE /api/v1/security/mfa/disable  (userId as query param)
  router.delete('/api/v1/security/mfa/disable', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
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
      const tenantId = requireOrgId(ctx);
      const userId =
        ctx.query.get('userId') || `admin@atlas.${tenantId.replace('tenant-', '')}.com`;
      const rec = securityStore.getMfaRecord(tenantId, userId);
      if (!rec || !rec.enrolled) return apiError(res, 'MFA not enrolled', 404);
      const remaining = rec.backupCodes.filter((c) => !rec.usedBackupCodes.includes(c));
      json(res, { remaining: remaining.length, codes: remaining });
    }
  );
}
