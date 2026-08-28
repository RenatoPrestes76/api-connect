/**
 * ATLAS 46.22 — Prisma-backed persistence for Runtime Registration (the
 * canonical Runtime identity — see docs/ADR-ATLAS-CANONICAL-CLIENT-
 * ONBOARDING.md). This is the ONLY file that touches
 * `prisma.runtimeRegistration` directly — everything else
 * (runtime-registration-store.ts, route handlers) goes through this
 * repository, matching the same HTTP -> Handler -> Service/Repository ->
 * Prisma -> PostgreSQL principle ATLAS 46.19 established for Tenant/
 * Organization (tenancy.repository.ts).
 *
 * Activation keys, certificates, sessions, and runtime config remain
 * in-memory in runtime-registration-store.ts — out of this sprint's scope
 * (the mandate was specifically "the Runtime registration itself must
 * survive a restart", not every auxiliary record).
 */
import { prisma } from '../../services/prisma.js';
import type { RuntimeRegistrationRecord, RuntimeStatus } from './types.js';

function toRecord(row: {
  id: string;
  organizationId: string;
  controlPlaneOrganizationId: string | null;
  machineFingerprintHash: string;
  publicKey: string;
  hostname: string;
  os: string;
  architecture: string;
  version: string;
  status: string;
  capabilities: string[];
  lastHeartbeat: Date | null;
  lastHeartbeatSignature: string | null;
  lastMemoryMb: number | null;
  lastCpuPercent: number | null;
  lastUptimeSeconds: number | null;
  registeredAt: Date;
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RuntimeRegistrationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    controlPlaneOrganizationId: row.controlPlaneOrganizationId,
    machineFingerprintHash: row.machineFingerprintHash,
    publicKey: row.publicKey,
    hostname: row.hostname,
    os: row.os,
    architecture: row.architecture,
    version: row.version,
    status: row.status as RuntimeStatus,
    capabilities: row.capabilities,
    lastHeartbeat: row.lastHeartbeat?.toISOString() ?? null,
    lastHeartbeatSignature: row.lastHeartbeatSignature,
    lastMemoryMb: row.lastMemoryMb,
    lastCpuPercent: row.lastCpuPercent,
    lastUptimeSeconds: row.lastUptimeSeconds,
    registeredAt: row.registeredAt.toISOString(),
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Narrow check for a Prisma unique-constraint violation (P2002), without importing @prisma/client's runtime error class (this codebase's established pattern — see control-plane/tenancy.repository.ts's isPrismaNotFoundError). */
function uniqueConstraintTarget(err: unknown): string[] | null {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  ) {
    const meta = (err as { meta?: { target?: unknown } }).meta;
    const target = meta?.target;
    if (Array.isArray(target)) return target as string[];
    if (typeof target === 'string') return [target];
    return [];
  }
  return null;
}

export type CreateRuntimeRegistrationError =
  | 'FINGERPRINT_DUPLICATE'
  | 'PUBLIC_KEY_ALREADY_REGISTERED';

export type CreateRuntimeRegistrationResult =
  | { ok: true; runtime: RuntimeRegistrationRecord }
  | { ok: false; error: CreateRuntimeRegistrationError };

export const runtimeRegistrationRepository = {
  async findById(id: string): Promise<RuntimeRegistrationRecord | undefined> {
    const row = await prisma.runtimeRegistration.findUnique({ where: { id } });
    return row ? toRecord(row) : undefined;
  },

  async findByFingerprintHash(hash: string): Promise<RuntimeRegistrationRecord | undefined> {
    const row = await prisma.runtimeRegistration.findFirst({
      where: { machineFingerprintHash: hash, status: { not: 'REVOKED' } },
    });
    return row ? toRecord(row) : undefined;
  },

  async findByPublicKey(publicKey: string): Promise<RuntimeRegistrationRecord | undefined> {
    const row = await prisma.runtimeRegistration.findFirst({
      where: { publicKey, status: { not: 'REVOKED' } },
    });
    return row ? toRecord(row) : undefined;
  },

  async list(
    filter: {
      organizationId?: string;
      controlPlaneOrganizationId?: string;
      status?: RuntimeStatus;
      /**
       * ATLAS 46.25 — Tenant is still not a column on RuntimeRegistration
       * (see the model's own header comment); this filters through the
       * `controlPlaneOrganization` relation, so it's exactly the same
       * derivation `GET .../runtimes/:id`'s `tenant` field and
       * tenant-association.test.ts already rely on, just applied as a
       * `WHERE` instead of a per-row read.
       */
      tenantId?: string;
    } = {}
  ): Promise<RuntimeRegistrationRecord[]> {
    const rows = await prisma.runtimeRegistration.findMany({
      where: {
        ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
        ...(filter.controlPlaneOrganizationId
          ? { controlPlaneOrganizationId: filter.controlPlaneOrganizationId }
          : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.tenantId ? { controlPlaneOrganization: { tenantId: filter.tenantId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  },

  /**
   * Inserted only after the caller (runtime-registration-store.ts) has
   * already validated the activation key — this repository's own job is
   * just the durable write plus the two identity-uniqueness guarantees the
   * database, not application code, is best positioned to enforce
   * atomically under concurrent registration attempts: no two Runtimes may
   * ever share a machine fingerprint or an Ed25519 public key.
   */
  async create(input: {
    organizationId: string;
    controlPlaneOrganizationId: string | null;
    machineFingerprintHash: string;
    publicKey: string;
    hostname: string;
    os: string;
    architecture: string;
    version: string;
    capabilities: string[];
  }): Promise<CreateRuntimeRegistrationResult> {
    try {
      const row = await prisma.runtimeRegistration.create({
        data: {
          organizationId: input.organizationId,
          controlPlaneOrganizationId: input.controlPlaneOrganizationId,
          machineFingerprintHash: input.machineFingerprintHash,
          publicKey: input.publicKey,
          hostname: input.hostname,
          os: input.os,
          architecture: input.architecture,
          version: input.version,
          capabilities: input.capabilities,
          status: 'REGISTERED',
        },
      });
      return { ok: true, runtime: toRecord(row) };
    } catch (err) {
      const target = uniqueConstraintTarget(err);
      if (target) {
        if (target.includes('publicKey'))
          return { ok: false, error: 'PUBLIC_KEY_ALREADY_REGISTERED' };
        return { ok: false, error: 'FINGERPRINT_DUPLICATE' };
      }
      throw err;
    }
  },

  async recordHeartbeat(
    id: string,
    data: {
      version: string;
      signature: string;
      memory?: number;
      cpu?: number;
      uptimeSeconds?: number;
      capabilities?: string[];
      /** Set only when the heartbeat should promote REGISTERED/PENDING -> ACTIVE. */
      activate?: boolean;
    }
  ): Promise<RuntimeRegistrationRecord | undefined> {
    const now = new Date();
    try {
      const row = await prisma.runtimeRegistration.update({
        where: { id },
        data: {
          version: data.version,
          lastHeartbeat: now,
          lastHeartbeatSignature: data.signature,
          ...(data.memory !== undefined ? { lastMemoryMb: data.memory } : {}),
          ...(data.cpu !== undefined ? { lastCpuPercent: data.cpu } : {}),
          ...(data.uptimeSeconds !== undefined ? { lastUptimeSeconds: data.uptimeSeconds } : {}),
          ...(data.capabilities !== undefined ? { capabilities: data.capabilities } : {}),
          ...(data.activate ? { status: 'ACTIVE', activatedAt: now } : {}),
        },
      });
      return toRecord(row);
    } catch {
      return undefined; // record not found (deleted/never existed) — caller maps to 404
    }
  },

  async updateStatus(
    id: string,
    status: RuntimeStatus
  ): Promise<RuntimeRegistrationRecord | undefined> {
    try {
      const row = await prisma.runtimeRegistration.update({
        where: { id },
        data: { status },
      });
      return toRecord(row);
    } catch {
      return undefined;
    }
  },
};
