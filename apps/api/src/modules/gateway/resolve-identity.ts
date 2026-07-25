import type { RouteContext } from '../../http/router.js';
import { verifyPortalSessionToken } from '../portal-identity/jwt.js';
import { portalIdentityStore } from '../portal-identity/portal-identity-store.js';
import { ROLE_PERMISSIONS } from '../portal-identity/permissions.js';
import { gatewayStore } from './gateway-store.js';
import { hashApiKeySecret } from './api-key-secret.js';
import type { ResolvedPortalIdentity } from './types.js';

function extractBearerToken(ctx: RouteContext): string | null {
  const header = ctx.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7);
}

function extractApiKey(ctx: RouteContext): string | null {
  const header = ctx.headers['x-api-key'];
  const value = Array.isArray(header) ? header[0] : header;
  return value ?? null;
}

/**
 * Resolves the calling identity for portal-scoped routes from EITHER a
 * user session (Bearer JWT) or a service API key (X-Api-Key: <publicId>.<secret>).
 * This is what makes "service-to-service" auth (Sprint 46.5 #3) work uniformly
 * across every existing portal route without duplicating permission logic.
 */
export async function resolvePortalIdentity(
  ctx: RouteContext
): Promise<ResolvedPortalIdentity | null> {
  const bearer = extractBearerToken(ctx);
  if (bearer) {
    const payload = await verifyPortalSessionToken(bearer);
    if (!payload) return null;
    const user = portalIdentityStore.findUserById(payload.sub);
    if (!user || user.status !== 'active') return null;
    return {
      organizationId: user.organizationId,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role],
      actorType: 'user',
      actorId: user.id,
      actorLabel: user.email,
    };
  }

  const apiKey = extractApiKey(ctx);
  if (apiKey) {
    const [publicId, secret] = apiKey.split('.');
    if (!publicId || !secret) return null;
    const key = gatewayStore.findApiKeyByPublicId(publicId);
    if (!key || key.status !== 'active') return null;
    if (key.secretHash !== hashApiKeySecret(secret)) return null;
    gatewayStore.recordApiKeyUsage(key.id);
    return {
      organizationId: key.organizationId,
      role: key.role,
      permissions: ROLE_PERMISSIONS[key.role],
      actorType: 'api_key',
      actorId: key.id,
      actorLabel: `${key.name} (${key.publicId})`,
    };
  }

  return null;
}
