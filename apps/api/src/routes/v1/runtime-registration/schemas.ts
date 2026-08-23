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

export const ListRuntimesQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  status: z.enum(RUNTIME_STATUSES).optional(),
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
