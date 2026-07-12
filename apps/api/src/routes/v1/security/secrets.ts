import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { envelopeDecrypt, deserializeEnvelope } from '@seltriva/aegis';

function resolveTenant(ctx: RouteContext): string {
  return (ctx.headers['x-tenant-id'] as string) || ctx.query.get('tenantId') || 'tenant-enterprise';
}

export function registerSecretsRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  // GET /api/v1/security/secrets
  router.get('/api/v1/security/secrets', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const secrets = securityStore.getSecrets(tenantId);
    json(res, { secrets, total: secrets.length });
  });

  // GET /api/v1/security/secrets/:id
  router.get('/api/v1/security/secrets/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const secret = securityStore.getSecretById(ctx.params['id']!);
    if (!secret) return apiError(res, 'Secret not found', 404);
    const { encryptedValue: _, ...metadata } = secret;
    json(res, {
      secret: { ...metadata, masked: `***${ctx.params['id']!.slice(-4).toUpperCase()}` },
    });
  });

  // POST /api/v1/security/secrets/:id/decrypt
  router.post(
    '/api/v1/security/secrets/:id/decrypt',
    async (ctx: RouteContext, res: ServerResponse) => {
      const secret = securityStore.getSecretById(ctx.params['id']!);
      if (!secret) return apiError(res, 'Secret not found', 404);
      try {
        const value = envelopeDecrypt(deserializeEnvelope(secret.encryptedValue));
        json(res, { id: secret.id, value, decryptedAt: new Date().toISOString() });
      } catch {
        apiError(res, 'Decryption failed', 500);
      }
    }
  );

  // POST /api/v1/security/secrets
  router.post('/api/v1/security/secrets', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const body = ctx.body as Record<string, unknown>;
    const { name, description, type, provider, value, tags = [], expiresAt = null } = body ?? {};
    if (!name || !type || !provider || !value)
      return apiError(res, 'name, type, provider, value required', 400);
    const secret = securityStore.createSecret(tenantId, {
      name: name as string,
      description: (description as string) || '',
      type: type as any,
      provider: provider as any,
      value: value as string,
      tags: tags as string[],
      expiresAt: expiresAt as string | null,
    });
    json(res, { secret }, 201);
  });

  // POST /api/v1/security/secrets/:id/rotate
  router.post(
    '/api/v1/security/secrets/:id/rotate',
    async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as Record<string, unknown>;
      if (!body?.['value']) return apiError(res, 'value required', 400);
      const secret = securityStore.rotateSecret(ctx.params['id']!, body['value'] as string);
      if (!secret) return apiError(res, 'Secret not found', 404);
      json(res, { secret });
    }
  );

  // DELETE /api/v1/security/secrets/:id
  router.delete('/api/v1/security/secrets/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const ok = securityStore.deleteSecret(ctx.params['id']!);
    if (!ok) return apiError(res, 'Secret not found', 404);
    json(res, { deleted: true });
  });
}
