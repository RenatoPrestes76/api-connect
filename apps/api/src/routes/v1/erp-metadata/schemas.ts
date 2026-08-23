import { z } from 'zod';

export const CreateDiscoveryBodySchema = z.object({
  runtimeId: z.string().min(1),
  organizationId: z.string().min(1),
  profileId: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
  maxAttempts: z.number().int().positive().optional(),
});

const DISCOVERY_STATUSES = [
  'REQUESTED',
  'REJECTED',
  'CLAIMED',
  'SCANNING',
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
] as const;

export const ListRequestsQuerySchema = z.object({
  runtimeId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  status: z.enum(DISCOVERY_STATUSES).optional(),
});

/**
 * `schema` is intentionally z.unknown() rather than a fully-typed
 * DatabaseSchema — that's a large, independently-owned nested contract from
 * @seltriva/database-intelligence, and it already has its own runtime
 * recovery path (erp-metadata-store.ts's reportSchema(), Sprint 46.17):
 * malformed/hostile schema content is caught there and routed through the
 * existing retry/backoff machine rather than crashing. This schema only
 * enforces the outer envelope's real contract (requestId/success/error),
 * matching "schema validates structure, deep classification failure is a
 * business-layer concern" — duplicating the full DatabaseSchema shape here
 * would risk silently diverging from its real definition and rejecting
 * genuinely valid Runtime reports.
 */
export const ReportSchemaBodySchema = z.object({
  requestId: z.string().min(1),
  success: z.boolean(),
  schema: z.unknown().optional(),
  error: z.string().optional(),
});
