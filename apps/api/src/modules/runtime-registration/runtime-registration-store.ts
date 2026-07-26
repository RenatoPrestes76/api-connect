import { randomUUID } from 'node:crypto';
import { portalIdentityStore } from '../portal-identity/portal-identity-store.js';
import { hashFingerprint } from './fingerprint.js';
import { issueCertificate } from './certificate.js';
import type {
  RuntimeRegistrationRecord,
  RuntimeCertificateRecord,
  ActivationKeyRecord,
  RuntimeStatus,
  RegisterRuntimeInput,
  RuntimeRegistrationDTO,
} from './types.js';

const ACTIVATION_KEY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type RegisterRuntimeError =
  | 'ORGANIZATION_NOT_FOUND'
  | 'ACTIVATION_KEY_INVALID'
  | 'ACTIVATION_KEY_EXPIRED'
  | 'ACTIVATION_KEY_ALREADY_USED'
  | 'FINGERPRINT_DUPLICATE';

export type RegisterRuntimeResult =
  | { ok: true; runtime: RuntimeRegistrationRecord; certificate: string }
  | { ok: false; error: RegisterRuntimeError };

let _instance: RuntimeRegistrationStore | null = null;

export class RuntimeRegistrationStore {
  private runtimes: RuntimeRegistrationRecord[] = [];
  private certificates: RuntimeCertificateRecord[] = [];
  private activationKeys: ActivationKeyRecord[] = [];

  private constructor() {
    this.seedDemoActivationKey();
  }

  static getInstance(): RuntimeRegistrationStore {
    if (!_instance) _instance = new RuntimeRegistrationStore();
    return _instance;
  }

  // ─── Seed ───────────────────────────────────────────────────────────────

  private seedDemoActivationKey(): void {
    const demoOrg = portalIdentityStore.findOrganizationByCode('ORG-0001');
    if (!demoOrg) return;
    const now = new Date();
    this.activationKeys.push({
      id: randomUUID(),
      code: 'ATLAS-DEMO-0001',
      organizationId: demoOrg.id,
      organizationCode: demoOrg.internalCode,
      used: false,
      usedAt: null,
      usedByRuntimeId: null,
      expiresAt: new Date(now.getTime() + ACTIVATION_KEY_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    });
  }

  // ─── Activation keys ────────────────────────────────────────────────────

  issueActivationKey(organizationId: string, organizationCode: string): ActivationKeyRecord {
    const now = new Date();
    const keySuffix = randomUUID().split('-')[0] ?? randomUUID();
    const record: ActivationKeyRecord = {
      id: randomUUID(),
      code: `ATLAS-${keySuffix.toUpperCase()}`,
      organizationId,
      organizationCode,
      used: false,
      usedAt: null,
      usedByRuntimeId: null,
      expiresAt: new Date(now.getTime() + ACTIVATION_KEY_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    };
    this.activationKeys.push(record);
    return record;
  }

  listActivationKeys(): ActivationKeyRecord[] {
    return [...this.activationKeys];
  }

  private findActivationKey(
    organizationCode: string,
    code: string
  ): ActivationKeyRecord | undefined {
    return this.activationKeys.find(
      (k) => k.organizationCode === organizationCode && k.code === code
    );
  }

  // ─── Runtimes ────────────────────────────────────────────────────────────

  findByFingerprintHash(hash: string): RuntimeRegistrationRecord | undefined {
    return this.runtimes.find((r) => r.machineFingerprintHash === hash && r.status !== 'REVOKED');
  }

  getRuntime(id: string): RuntimeRegistrationRecord | undefined {
    return this.runtimes.find((r) => r.id === id);
  }

  listRuntimes(
    filter: { organizationId?: string; status?: RuntimeStatus } = {}
  ): RuntimeRegistrationRecord[] {
    return this.runtimes.filter((r) => {
      if (filter.organizationId && r.organizationId !== filter.organizationId) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
  }

  async registerRuntime(input: RegisterRuntimeInput): Promise<RegisterRuntimeResult> {
    const org = portalIdentityStore.findOrganizationByCode(input.organizationCode);
    if (!org) return { ok: false, error: 'ORGANIZATION_NOT_FOUND' };

    const key = this.findActivationKey(input.organizationCode, input.activationKey);
    if (!key) return { ok: false, error: 'ACTIVATION_KEY_INVALID' };
    if (key.used) return { ok: false, error: 'ACTIVATION_KEY_ALREADY_USED' };
    if (new Date(key.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'ACTIVATION_KEY_EXPIRED' };
    }

    const fingerprintHash = hashFingerprint(input.fingerprint);
    if (this.findByFingerprintHash(fingerprintHash)) {
      return { ok: false, error: 'FINGERPRINT_DUPLICATE' };
    }

    const now = new Date();
    const runtime: RuntimeRegistrationRecord = {
      id: randomUUID(),
      organizationId: org.id,
      machineFingerprintHash: fingerprintHash,
      hostname: input.hostname,
      os: input.os,
      architecture: input.architecture ?? 'unknown',
      version: input.runtimeVersion,
      status: 'REGISTERED',
      publicKey: input.publicKey,
      lastHeartbeat: null,
      lastHeartbeatSignature: null,
      registeredAt: now.toISOString(),
      activatedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.runtimes.push(runtime);

    const issued = await issueCertificate(runtime.id, input.publicKey);
    this.certificates.push({
      id: randomUUID(),
      runtimeId: runtime.id,
      publicKey: input.publicKey,
      certificateId: issued.certificateId,
      issuedAt: issued.issuedAt.toISOString(),
      expiresAt: issued.expiresAt.toISOString(),
      revoked: false,
      revokedAt: null,
    });

    key.used = true;
    key.usedAt = now.toISOString();
    key.usedByRuntimeId = runtime.id;

    return { ok: true, runtime, certificate: issued.certificate };
  }

  /** True when `signature` was already accepted for this runtime's most recent heartbeat — rejects verbatim request replay. */
  isReplayedSignature(id: string, signature: string): boolean {
    const runtime = this.getRuntime(id);
    return runtime?.lastHeartbeatSignature === signature;
  }

  recordHeartbeat(
    id: string,
    data: { version: string; status?: string; signature: string }
  ): RuntimeRegistrationRecord | null {
    const runtime = this.getRuntime(id);
    if (!runtime) return null;
    if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') return null;

    const now = new Date().toISOString();
    runtime.lastHeartbeat = now;
    runtime.lastHeartbeatSignature = data.signature;
    runtime.version = data.version;
    runtime.updatedAt = now;
    if (runtime.status === 'REGISTERED' || runtime.status === 'PENDING') {
      runtime.status = 'ACTIVE';
      runtime.activatedAt = now;
    }
    return runtime;
  }

  blockRuntime(id: string): RuntimeRegistrationRecord | null {
    const runtime = this.getRuntime(id);
    if (!runtime) return null;
    runtime.status = 'BLOCKED';
    runtime.updatedAt = new Date().toISOString();
    return runtime;
  }

  reactivateRuntime(id: string): RuntimeRegistrationRecord | null {
    const runtime = this.getRuntime(id);
    if (!runtime || runtime.status !== 'BLOCKED') return null;
    runtime.status = runtime.lastHeartbeat ? 'ACTIVE' : 'REGISTERED';
    runtime.updatedAt = new Date().toISOString();
    return runtime;
  }

  // ─── Certificates ────────────────────────────────────────────────────────

  getCertificate(runtimeId: string): RuntimeCertificateRecord | undefined {
    return this.certificates.find((c) => c.runtimeId === runtimeId);
  }

  findCertificateByCertificateId(certificateId: string): RuntimeCertificateRecord | undefined {
    return this.certificates.find((c) => c.certificateId === certificateId);
  }

  revokeCertificate(runtimeId: string): RuntimeCertificateRecord | null {
    const cert = this.getCertificate(runtimeId);
    if (!cert || cert.revoked) return null;
    cert.revoked = true;
    cert.revokedAt = new Date().toISOString();
    const runtime = this.getRuntime(runtimeId);
    if (runtime) {
      runtime.status = 'REVOKED';
      runtime.updatedAt = new Date().toISOString();
    }
    return cert;
  }

  // ─── DTO ─────────────────────────────────────────────────────────────────

  toDTO(runtime: RuntimeRegistrationRecord): RuntimeRegistrationDTO {
    return {
      runtimeId: runtime.id,
      organizationId: runtime.organizationId,
      hostname: runtime.hostname,
      os: runtime.os,
      architecture: runtime.architecture,
      version: runtime.version,
      status: runtime.status,
      lastHeartbeat: runtime.lastHeartbeat,
      registeredAt: runtime.registeredAt,
      activatedAt: runtime.activatedAt,
    };
  }
}

export const runtimeRegistrationStore = RuntimeRegistrationStore.getInstance();
