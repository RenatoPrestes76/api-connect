/**
 * Real HTTP client for apps/api's `runtime-registration` + `erp-metadata`
 * protocol. Every function here issues a genuine `fetch()` against a real
 * Atlas API base URL — nothing here calls apps/api's internal services
 * directly. See docs/ATLAS-RUNTIME-CLIENT-AUDIT.md for the protocol this
 * mirrors and docs/ATLAS-RUNTIME-CLIENT.md for usage.
 */
import type { AtlasRuntimeIdentity } from './identity.js';
import { canonicalHeartbeatPayload, canonicalAuthTokenPayload, signPayload } from './protocol.js';

export class AtlasApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AtlasApiError';
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 10_000, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...rest.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { code: string; message: string };
    [key: string]: unknown;
  };
  if (!res.ok) {
    throw new AtlasApiError(
      body.error?.message ?? `HTTP ${res.status}`,
      res.status,
      body.error?.code
    );
  }
  // Some routes wrap the payload in { data }, others return the DTO at the
  // top level (matching apps/api's own inconsistency here — not something
  // this client should paper over by guessing).
  return (body.data ?? body) as T;
}

/**
 * Retries a fresh attempt (not a resend) up to `maxAttempts` times with
 * exponential backoff. `attempt` must build an entirely new
 * timestamp/signature/nonce-equivalent each call — the protocol's replay
 * protection is timestamp-window + exact-signature dedupe (see
 * docs/ATLAS-RUNTIME-CLIENT-AUDIT.md), so resending identical bytes on
 * retry would be rejected as a replay even though it's the same logical
 * request.
 */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      // Don't retry a request the server actively rejected as invalid
      // (bad signature, bad tenant, validation error) — only transient
      // failures (network error, 5xx, timeout) are worth a fresh attempt.
      if (err instanceof AtlasApiError && err.status < 500) throw err;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastErr;
}

// ─── Registration ────────────────────────────────────────────────────────

export interface RegisterInput {
  organizationCode: string;
  activationKey: string;
  runtimeVersion: string;
  hostname: string;
  os: string;
  architecture?: string;
  capabilities?: string[];
}

export interface RegisterResult {
  runtimeId: string;
  certificate: string;
  organizationId: string;
  capabilities: string[];
  pollingInterval: number;
  heartbeatInterval: number;
}

export async function registerRuntime(
  apiUrl: string,
  identity: AtlasRuntimeIdentity,
  input: RegisterInput
): Promise<RegisterResult> {
  return withRetry(() =>
    requestJson<RegisterResult>(`${apiUrl}/runtime/register`, {
      method: 'POST',
      body: JSON.stringify({
        organizationCode: input.organizationCode,
        activationKey: input.activationKey,
        runtimeVersion: input.runtimeVersion,
        fingerprint: identity.fingerprint,
        publicKey: identity.publicKeyPem,
        hostname: input.hostname,
        os: input.os,
        architecture: input.architecture,
        capabilities: input.capabilities,
      }),
    })
  );
}

// ─── Auth token exchange ─────────────────────────────────────────────────

export interface AccessTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function obtainAccessToken(
  apiUrl: string,
  runtimeId: string,
  privateKeyPem: string
): Promise<AccessTokenResult> {
  return withRetry(() => {
    // Rebuilt inside the retried closure — a fresh timestamp (and
    // therefore a fresh signature) on every attempt.
    const timestamp = new Date().toISOString();
    const signature = signPayload(
      privateKeyPem,
      canonicalAuthTokenPayload({ runtimeId, timestamp })
    );
    return requestJson<AccessTokenResult>(`${apiUrl}/runtime/auth/token`, {
      method: 'POST',
      body: JSON.stringify({ runtimeId, timestamp, signature }),
    });
  });
}

// ─── Heartbeat ───────────────────────────────────────────────────────────

export interface HeartbeatMetrics {
  version: string;
  memory: number;
  cpu: number;
  uptimeSeconds?: number;
  status?: string;
  capabilities?: string[];
}

export interface HeartbeatResult {
  runtimeId: string;
  status: string;
  capabilities: string[];
  lastHeartbeat: string | null;
}

export async function sendHeartbeat(
  apiUrl: string,
  identity: AtlasRuntimeIdentity,
  metrics: HeartbeatMetrics
): Promise<HeartbeatResult> {
  if (!identity.runtimeId) throw new Error('Cannot heartbeat before registration');
  const runtimeId = identity.runtimeId;

  return withRetry(() => {
    const timestamp = new Date().toISOString();
    const signature = signPayload(
      identity.privateKeyPem,
      canonicalHeartbeatPayload({
        runtimeId,
        version: metrics.version,
        memory: metrics.memory,
        cpu: metrics.cpu,
        status: metrics.status,
        timestamp,
      })
    );
    return requestJson<HeartbeatResult>(`${apiUrl}/runtime/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({
        runtimeId,
        version: metrics.version,
        memory: metrics.memory,
        cpu: metrics.cpu,
        uptimeSeconds: metrics.uptimeSeconds,
        status: metrics.status,
        capabilities: metrics.capabilities,
        timestamp,
        signature,
      }),
    });
  });
}

// ─── Discovery jobs ──────────────────────────────────────────────────────

export interface DiscoveryJob {
  id: string;
  runtimeId: string;
  organizationId: string;
  profileId: string;
  status: string;
}

export async function pollJobs(apiUrl: string, accessToken: string): Promise<DiscoveryJob[]> {
  const result = await withRetry(() =>
    requestJson<{ total: number; requests: DiscoveryJob[] }>(
      `${apiUrl}/erp-metadata/runtime/jobs`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
  );
  return result.requests;
}

export interface SubmitResultInput {
  requestId: string;
  runtimeId: string;
  success: boolean;
  schema?: unknown;
  error?: string;
}

export interface SubmitResultResponse {
  request: { id: string; status: string };
  reused: boolean;
}

export async function submitResult(
  apiUrl: string,
  accessToken: string,
  input: SubmitResultInput
): Promise<SubmitResultResponse> {
  return withRetry(() =>
    requestJson<SubmitResultResponse>(`${apiUrl}/erp-metadata/runtime/result`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input),
    })
  );
}
