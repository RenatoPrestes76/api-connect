import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { envelopeDecrypt, deserializeEnvelope, type AuditAction } from '@seltriva/aegis';

function actor(ctx: RouteContext): string {
  return ctx.adminEmail ?? ctx.userId ?? 'unknown';
}

function requestIp(ctx: RouteContext): string {
  const forwarded = ctx.headers['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? 'unknown';
}

function auditSecretEvent(
  ctx: RouteContext,
  action: AuditAction,
  tenantId: string,
  secretId: string,
  metadata: Record<string, unknown> = {}
): void {
  securityStore.appendAuditEvent({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    actor: actor(ctx),
    tenantId,
    resource: 'secrets',
    resourceId: secretId,
    ip: requestIp(ctx),
    userAgent: (ctx.headers['user-agent'] as string) ?? 'unknown',
    before: null,
    after: null,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

export function registerSecretsRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  // GET /api/v1/security/secrets
  router.get('/api/v1/security/secrets', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
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

  // POST /api/v1/security/secrets/:id/decrypt — audited: this reveals plaintext.
  router.post(
    '/api/v1/security/secrets/:id/decrypt',
    async (ctx: RouteContext, res: ServerResponse) => {
      const secret = securityStore.getSecretById(ctx.params['id']!);
      if (!secret) return apiError(res, 'Secret not found', 404);
      try {
        const value = envelopeDecrypt(deserializeEnvelope(secret.encryptedValue));
        auditSecretEvent(ctx, 'secret_accessed', secret.tenantId, secret.id, { name: secret.name });
        json(res, { id: secret.id, value, decryptedAt: new Date().toISOString() });
      } catch {
        apiError(res, 'Decryption failed', 500);
      }
    }
  );

  // POST /api/v1/security/secrets
  router.post('/api/v1/security/secrets', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const body = ctx.body as Record<string, unknown>;
    const {
      name,
      description,
      type,
      provider,
      value,
      tags = [],
      expiresAt = null,
      autoRotate = false,
      rotationIntervalDays = null,
    } = body ?? {};
    if (!name || !type || !provider || !value)
      return apiError(res, 'name, type, provider, value required', 400);
    if (autoRotate && !rotationIntervalDays) {
      return apiError(res, 'rotationIntervalDays is required when autoRotate is true', 400);
    }
    const secret = await securityStore.createSecret(tenantId, {
      name: name as string,
      description: (description as string) || '',
      type: type as any,
      provider: provider as any,
      value: value as string,
      tags: tags as string[],
      expiresAt: expiresAt as string | null,
      autoRotate: autoRotate as boolean,
      rotationIntervalDays: rotationIntervalDays as number | null,
    });
    auditSecretEvent(ctx, 'secret_created', tenantId, secret.id, {
      name: secret.name,
      provider: secret.provider,
    });
    json(res, { secret }, 201);
  });

  // POST /api/v1/security/secrets/:id/rotate
  router.post(
    '/api/v1/security/secrets/:id/rotate',
    async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as Record<string, unknown>;
      if (!body?.['value']) return apiError(res, 'value required', 400);
      const existing = securityStore.getSecretById(ctx.params['id']!);
      if (!existing) return apiError(res, 'Secret not found', 404);
      const secret = await securityStore.rotateSecret(ctx.params['id']!, body['value'] as string);
      if (!secret) return apiError(res, 'Secret not found', 404);
      auditSecretEvent(ctx, 'secret_rotated', existing.tenantId, secret.id, {
        version: secret.version,
      });
      json(res, { secret });
    }
  );

  // DELETE /api/v1/security/secrets/:id
  router.delete('/api/v1/security/secrets/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const existing = securityStore.getSecretById(ctx.params['id']!);
    if (!existing) return apiError(res, 'Secret not found', 404);
    const ok = securityStore.deleteSecret(ctx.params['id']!);
    if (!ok) return apiError(res, 'Secret not found', 404);
    auditSecretEvent(ctx, 'secret_deleted', existing.tenantId, existing.id, {
      name: existing.name,
    });
    json(res, { deleted: true });
  });
}
