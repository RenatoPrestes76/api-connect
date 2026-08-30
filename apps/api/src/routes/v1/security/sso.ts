import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { generateKey, generateNonce } from '@seltriva/aegis';
import type { SSOProviderSlug, SSOProtocol } from '@seltriva/aegis';

interface CreateSsoProviderBody {
  name?: string;
  slug?: SSOProviderSlug;
  protocol?: SSOProtocol;
  issuer?: string;
  clientId?: string;
  discoveryUrl?: string;
  ssoUrl?: string;
  logoutUrl?: string;
  certificate?: string;
}

/**
 * ATLAS 46.26 — GET/DELETE .../sso/:id previously took the provider id
 * from the URL with no tenant check — any authenticated caller could read
 * another tenant's SSO configuration (issuer, clientId, discovery/SSO
 * URLs) or delete it outright, denying that tenant's SSO login. Every
 * route below now requires the session-derived org and verifies
 * ownership.
 *
 * Note (pre-existing, not introduced by this fix, out of security-audit
 * scope): `initiate` reads as though it were meant to be the actual
 * login-start redirect — usable before the caller has any Atlas session —
 * but this whole module sits behind server.ts's global, generic
 * authMiddleware (billing/security/ops are not in its
 * PUBLIC_PATH_PREFIXES bypass list), so in the deployed system `initiate`
 * already requires a valid Supabase session today, same as every other
 * route here. That makes it *more* locked down than its own design intent
 * (an availability/functional bug, not a vulnerability — the opposite
 * direction from every other finding in this audit), so it's left as-is
 * and flagged as a residual/follow-up item rather than fixed here.
 *
 * Final hardening, Part 4 — re-verified: this is a stale comment
 * describing intended behavior, not a real gap. Current, actual behavior
 * is safe (auth required, only public provider metadata returned, no
 * secret). No code change made — no architecture change, auth not
 * relaxed, route not made public. Regression test:
 * "returns 401 unauthenticated" in security-routes.test.ts's
 * `POST /api/v1/security/sso/:id/initiate` block.
 */
export function registerSsoRoutes(router: Router): void {
  // GET /api/v1/security/sso
  router.get('/api/v1/security/sso', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const providers = securityStore.getSsoProviders(tenantId);
    json(res, { providers, total: providers.length });
  });

  // GET /api/v1/security/sso/:id
  router.get('/api/v1/security/sso/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const provider = securityStore.getSsoProviderById(ctx.params['id']);
    if (!provider || provider.tenantId !== tenantId) {
      return apiError(res, 'SSO provider not found', 404);
    }
    json(res, { provider });
  });

  // POST /api/v1/security/sso/:id/initiate — deliberately unauthenticated:
  // this is the login-start redirect, called before the caller has any
  // Atlas session. It only ever returns a redirect URL built from public
  // provider metadata (issuer/clientId), never a secret.
  router.post(
    '/api/v1/security/sso/:id/initiate',
    async (ctx: RouteContext, res: ServerResponse) => {
      const provider = securityStore.getSsoProviderById(ctx.params['id']);
      if (!provider) return apiError(res, 'SSO provider not found', 404);
      if (!provider.active) return apiError(res, 'SSO provider is inactive', 400);
      const state = generateKey(16);
      const nonce = generateNonce();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const baseUrl = provider.ssoUrl || provider.discoveryUrl || provider.issuer;
      const redirectUrl = `${baseUrl}?response_type=code&client_id=${provider.clientId}&state=${state}&nonce=${nonce}`;
      json(res, { redirectUrl, state, nonce, expiresAt });
    }
  );

  // POST /api/v1/security/sso
  router.post('/api/v1/security/sso', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const body = (ctx.body as CreateSsoProviderBody | undefined) ?? {};
    const { name, slug, protocol, issuer, clientId, discoveryUrl, ssoUrl, logoutUrl, certificate } =
      body;
    if (!name || !slug || !protocol || !issuer)
      return apiError(res, 'name, slug, protocol, issuer required', 400);
    const provider = securityStore.createSsoProvider({
      tenantId,
      name,
      slug,
      protocol,
      issuer,
      clientId: clientId || '',
      discoveryUrl: discoveryUrl || null,
      ssoUrl: ssoUrl || null,
      logoutUrl: logoutUrl || null,
      certificate: certificate || null,
      active: true,
    });
    json(res, { provider }, 201);
  });

  // DELETE /api/v1/security/sso/:id
  router.delete('/api/v1/security/sso/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const existing = securityStore.getSsoProviderById(ctx.params['id']);
    if (!existing || existing.tenantId !== tenantId) {
      return apiError(res, 'SSO provider not found', 404);
    }
    const ok = securityStore.deleteSsoProvider(ctx.params['id']);
    if (!ok) return apiError(res, 'SSO provider not found', 404);
    json(res, { deleted: true });
  });
}
