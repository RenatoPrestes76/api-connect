import { z } from 'zod';

// dbType is intentionally z.string() here, not a whitelist enum — the
// existing isSupportedDbType() business check (routes/v1/erp-connectivity/
// profiles.ts) is the authority for "which DB types are actually supported"
// and owns its own UNSUPPORTED_DB_TYPE error code; this schema only rejects
// structurally invalid input (missing/wrong-typed), not business-invalid
// values, matching the "schema validates structure, not business rules"
// split.
// No `password` field (Sprint A2.6) — the cloud never stores an ERP
// credential, in any form. See docs/ATLAS-RUNTIME-CLIENT.md's "ERP
// credentials never leave the client machine".
export const CreateProfileBodySchema = z.object({
  runtimeId: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  erpName: z.string().optional(),
  dbType: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  username: z.string().min(1),
  additionalParams: z.record(z.string()).optional(),
});

export const UpdateProfileBodySchema = z.object({
  name: z.string().min(1).optional(),
  erpName: z.string().optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().positive().optional(),
  database: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  additionalParams: z.record(z.string()).optional(),
});

const CONNECTION_STATUSES = [
  'PENDING_VALIDATION',
  'HEALTHY',
  'DEGRADED',
  'RECONNECTING',
  'CIRCUIT_OPEN',
  'DOWN',
  'DISABLED',
] as const;

export const ListProfilesQuerySchema = z.object({
  runtimeId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  status: z.enum(CONNECTION_STATUSES).optional(),
});
