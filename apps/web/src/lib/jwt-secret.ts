/**
 * HUB_JWT_SECRET falls back to a hardcoded, source-controlled dev value so
 * `pnpm dev` works with zero setup — but a production deploy of this app
 * that forgot to set the env var would silently sign/verify sessions
 * against the well-known default below, letting anyone in with a
 * self-forged cookie. Mirrors apps/api/src/services/production-secrets.ts's
 * shape. Shared by middleware.ts (verify) and api/hub/login/route.ts (sign)
 * so both fail the same way if misconfigured.
 */
const DEV_FALLBACK = 'atlas-hub-dev-secret-change-in-prod';

export function getHubJwtSecret(): string {
  const value = process.env['HUB_JWT_SECRET'];
  if (value) return value;

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'Refusing to run in production with a hardcoded dev secret. Set HUB_JWT_SECRET.'
    );
  }
  return DEV_FALLBACK;
}
