import { z } from 'zod';

export const IssueActivationKeyBodySchema = z.object({
  organizationCode: z.string().min(1),
});

export const RuntimeAuthTokenBodySchema = z.object({
  runtimeId: z.string().min(1),
  timestamp: z.string().min(1),
  signature: z.string().min(1),
});

export const RuntimeRefreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const RUNTIME_STATUSES = ['PENDING', 'REGISTERED', 'ACTIVE', 'BLOCKED', 'REVOKED'] as const;
const RUNTIME_LIVENESS_VALUES = ['ONLINE', 'STALE', 'OFFLINE'] as const;

// ATLAS 46.25, Part B — controlPlaneOrganizationId/tenantId/liveness are
// additive, optional filters. tenantId filters through the
// controlPlaneOrganization relation (Runtime itself has no tenantId column
// — see runtime-registration.repository.ts's list()); liveness filters on
// a value computed at read time (see liveness.ts), never a stored column.
export const ListRuntimesQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  controlPlaneOrganizationId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  status: z.enum(RUNTIME_STATUSES).optional(),
  liveness: z.enum(RUNTIME_LIVENESS_VALUES).optional(),
});

// ATLAS 46.25, Part C — the operational summary accepts the same
// persisted-data scoping filters as the list above, minus status/liveness
// (the summary's whole point is to break the scope down BY liveness).
export const RuntimeSummaryQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  controlPlaneOrganizationId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
});

const RETRY_POLICY_PATCH_SCHEMA = z.object({
  maxAttempts: z.number().int().positive().optional(),
  backoffMs: z.number().int().positive().optional(),
});

export const RuntimeConfigPatchSchema = z.object({
  pollingIntervalMs: z.number().int().positive().optional(),
  heartbeatIntervalMs: z.number().int().positive().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  compressionEnabled: z.boolean().optional(),
  retryPolicy: RETRY_POLICY_PATCH_SCHEMA.optional(),
  connectionTimeoutMs: z.number().int().positive().optional(),
  databaseTimeoutMs: z.number().int().positive().optional(),
});
