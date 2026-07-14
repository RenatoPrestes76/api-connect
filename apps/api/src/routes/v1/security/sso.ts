import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { generateKey, generateNonce } from '@seltriva/aegis';

export function registerSsoRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  // GET /api/v1/security/sso
  router.get('/api/v1/security/sso', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const providers = securityStore.getSsoProviders(tenantId);
    json(res, { providers, total: providers.length });
  });

  // GET /api/v1/security/sso/:id
  router.get('/api/v1/security/sso/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const provider = securityStore.getSsoProviderById(ctx.params['id']!);
    if (!provider) return apiError(res, 'SSO provider not found', 404);
    json(res, { provider });
  });

  // POST /api/v1/security/sso/:id/initiate
  router.post(
    '/api/v1/security/sso/:id/initiate',
    async (ctx: RouteContext, res: ServerResponse) => {
      const provider = securityStore.getSsoProviderById(ctx.params['id']!);
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
    const tenantId = requireTenantId(ctx);
    const body = ctx.body as Record<string, string | undefined>;
    const { name, slug, protocol, issuer, clientId, discoveryUrl, ssoUrl, logoutUrl, certificate } =
      body ?? {};
    if (!name || !slug || !protocol || !issuer)
      return apiError(res, 'name, slug, protocol, issuer required', 400);
    const provider = securityStore.createSsoProvider({
      tenantId,
      name,
      slug: slug as any,
      protocol: protocol as any,
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
    const ok = securityStore.deleteSsoProvider(ctx.params['id']!);
    if (!ok) return apiError(res, 'SSO provider not found', 404);
    json(res, { deleted: true });
  });
}
