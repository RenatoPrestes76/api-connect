import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import { registrationRateLimiter } from '../../../modules/runtime-registration/rate-limiter.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { connectorsStore } from '../../../modules/connectors/connectors-store.js';
import type { RegisterRuntimeInput } from '../../../modules/runtime-registration/types.js';
import {
  MIN_RUNTIME_VERSION,
  isVersionAtLeast,
} from '../../../modules/runtime-registration/version-control.js';

function clientIp(ctx: RouteContext): string {
  const header = ctx.headers['x-forwarded-for'];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.split(',')[0]?.trim() ?? 'unknown';
}

const ERROR_STATUS: Record<string, { status: number; code: string; message: string }> = {
  ORGANIZATION_NOT_FOUND: {
    status: 404,
    code: 'ORGANIZATION_NOT_FOUND',
    message: 'Organization not found for the given organizationCode',
  },
  ACTIVATION_KEY_INVALID: {
    status: 401,
    code: 'ACTIVATION_KEY_INVALID',
    message: 'Invalid activation key',
  },
  ACTIVATION_KEY_EXPIRED: {
    status: 401,
    code: 'ACTIVATION_KEY_EXPIRED',
    message: 'Activation key has expired',
  },
  ACTIVATION_KEY_ALREADY_USED: {
    status: 409,
    code: 'ACTIVATION_KEY_ALREADY_USED',
    message: 'Activation key has already been used (single-use)',
  },
  ACTIVATION_KEY_REVOKED: {
    status: 401,
    code: 'ACTIVATION_KEY_REVOKED',
    message: 'Activation key has been revoked',
  },
  FINGERPRINT_DUPLICATE: {
    status: 409,
    code: 'FINGERPRINT_DUPLICATE',
    message: 'A Runtime with this machine fingerprint is already registered',
  },
  PUBLIC_KEY_ALREADY_REGISTERED: {
    status: 409,
    code: 'PUBLIC_KEY_ALREADY_REGISTERED',
    message: 'This Ed25519 public key is already registered to a different Runtime',
  },
};

export async function registerRuntimeHandler(
  ctx: RouteContext,
  res: ServerResponse
): Promise<void> {
  const ip = clientIp(ctx);
  if (registrationRateLimiter.isLocked(ip)) {
    apiError(res, 'Too many registration attempts — try again later', 429, 'RATE_LIMITED');
    return;
  }

  const body = ctx.body as Partial<RegisterRuntimeInput> | undefined;
  const required: Array<keyof RegisterRuntimeInput> = [
    'organizationCode',
    'activationKey',
    'runtimeVersion',
    'fingerprint',
    'publicKey',
    'hostname',
    'os',
  ];
  const missing = required.filter((k) => !body?.[k]);
  if (missing.length > 0) {
    registrationRateLimiter.recordFailure(ip);
    apiError(res, `Missing required fields: ${missing.join(', ')}`, 422, 'VALIDATION_ERROR');
    return;
  }
  const input = body as RegisterRuntimeInput;

  if (!isVersionAtLeast(input.runtimeVersion, MIN_RUNTIME_VERSION)) {
    registrationRateLimiter.recordFailure(ip);
    apiError(
      res,
      `Runtime version ${input.runtimeVersion} is below the minimum supported version ${MIN_RUNTIME_VERSION}`,
      422,
      'UNSUPPORTED_RUNTIME_VERSION'
    );
    return;
  }

  const result = await runtimeRegistrationStore.registerRuntime(input);

  if (!result.ok) {
    registrationRateLimiter.recordFailure(ip);
    const mapped = ERROR_STATUS[result.error];
    apiError(res, mapped.message, mapped.status, mapped.code);
    return;
  }

  registrationRateLimiter.recordSuccess(ip);

  const { runtime, certificate } = result;
  adminIdentityStore.recordAudit({
    action: 'RUNTIME_REGISTERED',
    actorEmail: 'runtime-installer@system',
    target: runtime.id,
    ip,
    metadata: { organizationId: runtime.organizationId, hostname: runtime.hostname },
  });

  const environments = portalIdentityStore
    .listEnvironments(runtime.organizationId)
    .map((e) => ({ id: e.id, name: e.name, kind: e.kind }));
  const connectorsEnabled = connectorsStore
    .listConnectors({ status: 'active' })
    .map((c) => c.identifier);
  const config = runtimeRegistrationStore.getRuntimeConfig(runtime.id);

  json(
    res,
    {
      data: {
        runtimeId: runtime.id,
        certificate,
        organizationId: runtime.organizationId,
        capabilities: runtime.capabilities,
        pollingInterval: config?.pollingIntervalMs ?? 60_000,
        heartbeatInterval: config?.heartbeatIntervalMs ?? 30_000,
        logLevel: config?.logLevel ?? 'info',
        compressionEnabled: config?.compressionEnabled ?? true,
        retryPolicy: config?.retryPolicy ?? { maxAttempts: 3, backoffMs: 2_000 },
        connectionTimeoutMs: config?.connectionTimeoutMs ?? 10_000,
        databaseTimeoutMs: config?.databaseTimeoutMs ?? 15_000,
        connectorsEnabled,
        environments,
        policies: {
          minRuntimeVersion: MIN_RUNTIME_VERSION,
          maxHeartbeatGapMs: 5 * 60_000,
        },
        limits: {
          maxSyncBatchSize: 500,
          maxConcurrentSyncs: 3,
        },
      },
    },
    201
  );
}
