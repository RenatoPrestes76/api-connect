/**
 * Canonical payload builders for the two Runtime-signed erp-connectivity
 * requests. Signature verification itself reuses
 * modules/runtime-registration/signature.ts's verifyRequestSignature — only
 * the shape of what gets signed is specific to this module.
 */

export function canonicalHealthReportPayload(input: {
  profileId: string;
  runtimeId: string;
  success: boolean;
  responseTimeMs?: number;
  activeConnections?: number;
  avgQueryTimeMs?: number;
  error?: string;
  timestamp: string;
}): string {
  return JSON.stringify({
    profileId: input.profileId,
    runtimeId: input.runtimeId,
    success: input.success,
    responseTimeMs: input.responseTimeMs ?? null,
    activeConnections: input.activeConnections ?? null,
    avgQueryTimeMs: input.avgQueryTimeMs ?? null,
    error: input.error ?? null,
    timestamp: input.timestamp,
  });
}

export function canonicalDiagnosticsReportPayload(input: {
  profileId: string;
  runtimeId: string;
  dns: string;
  tcp: string;
  authentication: string;
  database: string;
  latencyMs?: number;
  permissions: string;
  driver: string;
  encryption: string;
  timestamp: string;
}): string {
  return JSON.stringify({
    profileId: input.profileId,
    runtimeId: input.runtimeId,
    dns: input.dns,
    tcp: input.tcp,
    authentication: input.authentication,
    database: input.database,
    latencyMs: input.latencyMs ?? null,
    permissions: input.permissions,
    driver: input.driver,
    encryption: input.encryption,
    timestamp: input.timestamp,
  });
}
