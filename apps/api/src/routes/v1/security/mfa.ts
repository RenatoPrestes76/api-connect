import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import {
  mfaVerifyRateLimiter,
  mfaSetupRateLimiter,
} from '../../../modules/security/rate-limiter.js';
import {
  generateTotpSecret,
  generateBackupCodes,
  verifyTotpToken,
  buildOtpUri,
  base32Decode,
} from '@seltriva/aegis';

const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;

/**
 * ATLAS 46.28 — replay protection (Etapa 6). verifyTotpToken() alone only
 * proves the token matches *some* step within the ±1 clock-skew window; it
 * doesn't say which one, and doesn't prevent the same captured code being
 * resubmitted repeatedly for as long as it stays inside that window
 * (RFC 6238 §5.2 explicitly calls out rejecting OTP reuse as a MUST-
 * consider mitigation). This determines the *exact* matched time-step by
 * re-checking each candidate step individually (windows=0 each), so the
 * caller can compare it against the record's lastUsedStep and reject an
 * exact repeat — without needing to change @seltriva/aegis's verify
 * function itself.
 */
function findMatchedTotpStep(secret: Buffer, token: string): number | null {
  const nowStep = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  for (let w = -TOTP_WINDOW_STEPS; w <= TOTP_WINDOW_STEPS; w++) {
    const step = nowStep + w;
    const stepTimeMs = step * TOTP_STEP_SECONDS * 1000;
    if (verifyTotpToken(secret, token, stepTimeMs, 0)) return step;
  }
  return null;
}

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
 *
 * ATLAS 46.28 — audited `userId` more broadly (Etapa 3, Q2): within a
 * tenant, `userId` is a client-supplied *resource identifier* ("which
 * named identity's MFA state"), not cross-checked against any per-caller
 * identity — the same trust model every other security/* resource in this
 * module already uses (secrets, SSO providers, policies, certificates,
 * risk events are all tenant-owned, not individual-caller-owned; "any
 * authenticated session for this tenant" is the established boundary
 * throughout, not unique to MFA). Not changed here: inventing a stricter
 * per-caller-identity model for MFA alone, while every sibling resource in
 * this module stays tenant-scoped, would be an inconsistent, novel
 * authorization philosophy for one endpoint family — real scope creep, not
 * a targeted fix. Flagged as a residual/architectural question for a
 * future, whole-module decision, not silently ignored.
 */
export function registerMfaRoutes(router: Router): void {
  // GET /api/v1/security/mfa/status
  router.get('/api/v1/security/mfa/status', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const userId = ctx.query.get('userId') || `admin@atlas.${tenantId.replace('tenant-', '')}.com`;
    const rec = securityStore.getMfaRecord(tenantId, userId);
    if (!rec) return json(res, { enrolled: false, userId, tenantId });
    const { secretBase32: _, backupCodes: __, lastUsedStep: ___, ...safe } = rec;
    json(res, {
      ...safe,
      backupCodesRemaining: rec.backupCodes.length - rec.usedBackupCodes.length,
    });
  });

  /**
   * ATLAS 46.28 — Etapa 4: this route had no rate limiting, and unlike a
   * passive read, it's a MUTATION that silently regenerates and overwrites
   * an existing enrollment's secret + backup codes every time it's called
   * — no confirmation of the *previous* factor is required. Left
   * unbounded, a caller (or a briefly-compromised session) could replace a
   * legitimate userId's MFA factor at will, or hammer the endpoint to
   * force inconsistent state. Rate limited the same shape as verify (5
   * calls / 15 minutes per tenantId+userId), a genuinely separate counter
   * (mfaSetupRateLimiter) so setup abuse and verify brute-forcing don't
   * share or reset each other's lockout window. 429, not 423 — this is a
   * request-rate throttle on a mutation, not an account-lockout response
   * to a suspected credential-guessing attack (that's what verify's 423
   * means).
   */
  // POST /api/v1/security/mfa/setup
  router.post('/api/v1/security/mfa/setup', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const body = ctx.body as Record<string, unknown>;
    const userId =
      (body?.['userId'] as string) || `admin@atlas.${tenantId.replace('tenant-', '')}.com`;

    if (mfaSetupRateLimiter.isLocked(tenantId, userId)) {
      return apiError(
        res,
        'Too many MFA setup attempts. Try again in 15 minutes.',
        429,
        'MFA_SETUP_RATE_LIMITED'
      );
    }
    mfaSetupRateLimiter.recordFailure(tenantId, userId);

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
      lastUsedStep: null,
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
   *
   * ATLAS 46.28 — Etapa 6: added replay protection. A verified code's
   * exact time-step is now tracked (`lastUsedStep`); resubmitting the same
   * code within its still-valid clock-skew window is rejected with the
   * same generic "Invalid or expired token" message as a wrong code (never
   * a distinct "replay detected" response — see Etapa 7, no oracle for
   * "this code was valid but already used") and counts toward the same
   * brute-force lockout as any other failed attempt.
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
    const matchedStep = findMatchedTotpStep(secretBuf, String(token));
    const isReplay = matchedStep !== null && matchedStep === rec.lastUsedStep;
    if (matchedStep === null || isReplay) {
      mfaVerifyRateLimiter.recordFailure(tenantId, userId);
      return json(res, { valid: false, message: 'Invalid or expired token' });
    }
    mfaVerifyRateLimiter.recordSuccess(tenantId, userId);
    securityStore.upsertMfaRecord({
      ...rec,
      lastUsedAt: new Date().toISOString(),
      lastUsedStep: matchedStep,
    });
    json(res, { valid: true });
  });

  // DELETE /api/v1/security/mfa/disable  (userId as query param)
  //
  // ATLAS 46.28 — Etapa 4/3 audited: no rate limiting added deliberately.
  // A single call already fully disables the factor (secretBase32/
  // backupCodes cleared) — repeated calls don't compound the harm the way
  // repeated setup/verify calls do, so a request-rate limiter here
  // wouldn't reduce real risk (consistent with `security/secrets/:id
  // /decrypt` in ATLAS 46.26, an equally "any tenant session can already
  // do this once" surface that also got no rate limiter, not an
  // inconsistency). The actual open question — should disabling MFA
  // require re-proving the current factor first? — is an authorization/
  // reauthentication design decision spanning intent beyond a rate-limit
  // fix; flagged as a residual, not silently fixed by adding a limiter
  // that wouldn't address it anyway.
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
      lastUsedStep: null,
    });
    json(res, { disabled: true, userId });
  });

  // GET /api/v1/security/mfa/backup-codes
  //
  // ATLAS 46.28 — Etapa 4/3 audited: no rate limiting added deliberately,
  // for the same reason as `disable` above and consistent with
  // `security/secrets/:id/decrypt` (ATLAS 46.26) — reading a sensitive
  // value your own tenant session is already trusted to read isn't a
  // brute-force/guessing surface, so a request-rate limiter wouldn't
  // reduce real risk (there's nothing being guessed here). Re-displaying
  // remaining backup codes to an already-authenticated session is a
  // deliberate recovery-support feature, not a leak.
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
