/**
 * Every one of these modules falls back to a hardcoded, source-controlled
 * "dev secret" when its env var is unset — necessary so `pnpm dev`/tests work
 * with zero setup, but the exact fallback strings (`grep` the filenames
 * below) would be equally well known to an attacker if they ever shipped
 * unmodified to production. Unlike DATABASE_URL/API_SECRET_KEY (validated by
 * packages/config's getConfig()), none of these were previously checked at
 * startup — a production deploy that forgot one would run indefinitely,
 * silently signing/encrypting with a public default.
 */
const REQUIRED_IN_PRODUCTION = [
  { envVar: 'ADMIN_JWT_SECRET', usedBy: 'modules/admin-identity/jwt.ts' },
  { envVar: 'PORTAL_JWT_SECRET', usedBy: 'modules/portal-identity/jwt.ts' },
  { envVar: 'RUNTIME_JWT_SECRET', usedBy: 'modules/runtime-registration/runtime-jwt.ts' },
  { envVar: 'RUNTIME_CERT_SECRET', usedBy: 'modules/runtime-registration/certificate.ts' },
  { envVar: 'CONNECTOR_PACKAGE_SECRET', usedBy: 'modules/connectors/package-integrity.ts' },
  { envVar: 'MESSAGE_DELIVERY_SECRET', usedBy: 'modules/message-delivery/message-signature.ts' },
  { envVar: 'ATLAS_MASTER_KEY', usedBy: '@seltriva/aegis crypto.ts (ERP credential encryption)' },
  // ATLAS 46.26 — found missing during the billing/security/ops audit.
  // middleware/auth.ts's generic Supabase-style authMiddleware (guards
  // everything NOT covered by a dedicated admin/portal/runtime auth scheme
  // — concretely /api/v1/billing/*, /api/v1/security/*, /api/v1/ops/*)
  // falls back to `createHmac('sha256', '')` (an empty, publicly-known
  // HMAC key) when this is unset, rather than refusing to boot — a
  // forgeable-JWT hole distinct from, and previously uncaught by, the dev-
  // only complete-bypass branch in that same file (which is correctly
  // gated to NODE_ENV==='development' already).
  { envVar: 'SUPABASE_JWT_SECRET', usedBy: 'middleware/auth.ts' },
] as const;

/**
 * Throws in production if any secret-bearing env var is unset and would
 * therefore fall back to its hardcoded dev default. No-op outside
 * production — every one of these vars is deliberately allowed to fall back
 * in dev/test so the stack runs with zero setup.
 */
export function assertProductionSecretsConfigured(env: string): void {
  if (env !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter(({ envVar }) => !process.env[envVar]);
  if (missing.length > 0) {
    const list = missing.map((m) => `${m.envVar} (used by ${m.usedBy})`).join(', ');
    throw new Error(
      `Refusing to start in production with hardcoded dev secrets. Missing env vars: ${list}`
    );
  }
}

/**
 * CORS_ALLOWED_ORIGINS unset (router.ts's allowedOrigin()) falls back to a
 * wildcard '*' — the right default for zero-setup local dev, but a silent
 * hole in production if the operator forgot to set it (e.g. render.yaml
 * marks it `sync: false`, precisely so it's easy to forget). Same
 * fail-loud-at-startup shape as assertProductionSecretsConfigured, for a
 * config gap rather than a secret one.
 */
export function assertProductionCorsConfigured(env: string): void {
  if (env !== 'production') return;

  const configured = process.env['CORS_ALLOWED_ORIGINS'];
  if (!configured || configured.trim() === '' || configured.trim() === '*') {
    throw new Error(
      'Refusing to start in production with an open CORS policy. Set CORS_ALLOWED_ORIGINS to a comma-separated allowlist (e.g. https://app.atlasappruntime.com.br,https://admin.atlasappruntime.com.br).'
    );
  }
}
