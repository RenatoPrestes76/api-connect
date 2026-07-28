import type { DatabaseSchema } from '@seltriva/database-sdk';

// ─── Lifecycle ───────────────────────────────────────────────────────────────
// REQUESTED (validated, awaiting claim) -> CLAIMED (Runtime picked it up) ->
// SCANNING -> COMPLETED | FAILED | TIMEOUT. Mirrors runtime-connector-
// execution's ExecutionLifecycleStatus shape/semantics — same create/claim/
// report/retry pattern, applied to schema discovery instead of a business
// command.

export type DiscoveryStatus =
  | 'REQUESTED'
  | 'REJECTED'
  | 'CLAIMED'
  | 'SCANNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT';

export const TERMINAL_DISCOVERY_STATUSES: readonly DiscoveryStatus[] = [
  'REJECTED',
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
];

// ─── Discovery request ───────────────────────────────────────────────────────

export interface DiscoveryRequestRecord {
  id: string;
  runtimeId: string;
  organizationId: string;
  profileId: string;
  createdBy: string;
  status: DiscoveryStatus;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  error: string | null;
  createdAt: string;
  scheduledAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
}

export interface DiscoveryRequestDTO {
  id: string;
  runtimeId: string;
  organizationId: string;
  profileId: string;
  createdBy: string;
  status: DiscoveryStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  scheduledAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
}

export interface CreateDiscoveryInput {
  runtimeId: string;
  organizationId: string;
  profileId: string;
  createdBy: string;
  timeoutMs?: number;
  maxAttempts?: number;
}

export type CreateDiscoveryError =
  | 'RUNTIME_NOT_FOUND'
  | 'RUNTIME_ORGANIZATION_MISMATCH'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_RUNTIME_MISMATCH';

// ─── Runtime-reported schema ─────────────────────────────────────────────────
// The Runtime performs the actual live introspection (via
// @seltriva/database-sdk's SchemaReader — that dependency's live drivers run
// only on the Runtime, never here) and reports the raw result back. apps/api
// only ever imports database-sdk's *types* (`import type`, erased at compile
// time — no driver code is ever bundled) to describe this shape, exactly
// like the existing PROMETHEUS discovery-adapter already does. See the
// module-level comment in erp-metadata-store.ts for the enforced boundary.

export interface ReportSchemaInput {
  requestId: string;
  runtimeId: string;
  success: boolean;
  schema?: DatabaseSchema;
  error?: string;
}

export type ReportSchemaError = 'REQUEST_NOT_FOUND' | 'RUNTIME_MISMATCH';

// ─── Cache (per connection profile) ──────────────────────────────────────────

export interface MetadataCacheEntry {
  profileId: string;
  /** Deterministic hash of the last-reported raw schema — unchanged checksum skips re-running the (comparatively expensive) ATHENA classifier entirely. */
  checksum: string;
  /** Increments only when the checksum actually changes, i.e. the ERP's structure was genuinely altered. */
  version: number;
  lastDiscoveredAt: string;
  lastRequestId: string;
}
