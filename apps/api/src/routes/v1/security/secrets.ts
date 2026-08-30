import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import {
  envelopeDecrypt,
  deserializeEnvelope,
  type AuditAction,
  type Secret,
} from '@seltriva/aegis';

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

interface CreateSecretBody {
  name?: string;
  description?: string;
  type?: Secret['type'];
  provider?: Secret['provider'];
  value?: string;
  tags?: string[];
  expiresAt?: string | null;
  autoRotate?: boolean;
  rotationIntervalDays?: number | null;
}

/**
 * ATLAS 46.26 — the single most severe finding of this audit: every `:id`
 * route below (GET, decrypt, rotate, delete) previously took the secret id
 * from the URL alone with NO tenant check whatsoever — most critically
 * `POST .../decrypt`, which returns the real plaintext value. Any caller
 * holding nothing more than a valid Supabase session could decrypt and
 * read, rotate, or delete any other tenant's stored secret by guessing or
 * enumerating an id. Fixed by requiring the session-derived org
 * (requireOrgId, never a client-supplied header) and verifying
 * `secret.tenantId` matches it before any read or mutation — a 404 either
 * way, so a response never distinguishes "doesn't exist" from "exists but
 * isn't yours".
 */
export function registerSecretsRoutes(router: Router): void {
  // GET /api/v1/security/secrets
  router.get('/api/v1/security/secrets', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const secrets = securityStore.getSecrets(tenantId);
    json(res, { secrets, total: secrets.length });
  });

  // GET /api/v1/security/secrets/:id
  router.get('/api/v1/security/secrets/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const secret = securityStore.getSecretById(ctx.params['id']);
    if (!secret || secret.tenantId !== tenantId) return apiError(res, 'Secret not found', 404);
    const { encryptedValue: _, ...metadata } = secret;
    json(res, {
      secret: { ...metadata, masked: `***${ctx.params['id'].slice(-4).toUpperCase()}` },
    });
  });

  // POST /api/v1/security/secrets/:id/decrypt — audited: this reveals plaintext.
  router.post(
    '/api/v1/security/secrets/:id/decrypt',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireOrgId(ctx);
      const secret = securityStore.getSecretById(ctx.params['id']);
      if (!secret || secret.tenantId !== tenantId) return apiError(res, 'Secret not found', 404);
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
    const tenantId = requireOrgId(ctx);
    const body = (ctx.body as CreateSecretBody | undefined) ?? {};
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
    } = body;
    if (!name || !type || !provider || !value)
      return apiError(res, 'name, type, provider, value required', 400);
    if (autoRotate && !rotationIntervalDays) {
      return apiError(res, 'rotationIntervalDays is required when autoRotate is true', 400);
    }
    const secret = await securityStore.createSecret(tenantId, {
      name,
      description: description ?? '',
      type,
      provider,
      value,
      tags,
      expiresAt,
      autoRotate,
      rotationIntervalDays,
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
      const tenantId = requireOrgId(ctx);
      const body = ctx.body as Record<string, unknown>;
      if (!body?.['value']) return apiError(res, 'value required', 400);
      const existing = securityStore.getSecretById(ctx.params['id']);
      if (!existing || existing.tenantId !== tenantId) {
        return apiError(res, 'Secret not found', 404);
      }
      const secret = await securityStore.rotateSecret(ctx.params['id'], body['value'] as string);
      if (!secret) return apiError(res, 'Secret not found', 404);
      auditSecretEvent(ctx, 'secret_rotated', existing.tenantId, secret.id, {
        version: secret.version,
      });
      json(res, { secret });
    }
  );

  // DELETE /api/v1/security/secrets/:id
  router.delete('/api/v1/security/secrets/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const existing = securityStore.getSecretById(ctx.params['id']);
    if (!existing || existing.tenantId !== tenantId) {
      return apiError(res, 'Secret not found', 404);
    }
    const ok = securityStore.deleteSecret(ctx.params['id']);
    if (!ok) return apiError(res, 'Secret not found', 404);
    auditSecretEvent(ctx, 'secret_deleted', existing.tenantId, existing.id, {
      name: existing.name,
    });
    json(res, { deleted: true });
  });
}
