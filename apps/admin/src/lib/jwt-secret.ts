/**
 * ADMIN_JWT_SECRET falls back to a hardcoded, source-controlled dev value
 * so `pnpm dev` works with zero setup — but this app is a separate process
 * from apps/api (which signs the session cookie this middleware verifies)
 * and has no fail-loud of its own. If a production deploy of this app
 * forgot to set the env var, it would silently verify sessions against the
 * well-known default below, letting anyone in with a self-forged cookie.
 * Mirrors apps/api/src/services/production-secrets.ts's shape.
 */
const DEV_FALLBACK = 'atlas-admin-dev-secret-change-in-prod';

export function getAdminJwtSecret(): string {
  const value = process.env['ADMIN_JWT_SECRET'];
  if (value) return value;

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'Refusing to run in production with a hardcoded dev secret. Set ADMIN_JWT_SECRET.'
    );
  }
  return DEV_FALLBACK;
}
