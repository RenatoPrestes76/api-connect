/**
 * Ed25519 identity lifecycle for the Atlas runtime-registration protocol
 * (apps/api's `runtime-registration` module — see
 * docs/ATLAS-RUNTIME-CLIENT-AUDIT.md for the protocol this was reverse-
 * engineered from). Generated once, persisted locally, reused across
 * process restarts. The private key never leaves this machine: it's never
 * sent to Atlas (only the public key is, at registration) and never
 * logged — every log line in this module and its callers must reference
 * `identity.runtimeId`/`identity.publicKeyPem` only.
 *
 * The private key is encrypted at rest (DPAPI on Windows, AES-256-GCM with
 * a local key file elsewhere — see `security/credential-encryption.ts`)
 * before it's written to disk. Everywhere else in this module and its
 * callers, `AtlasRuntimeIdentity.privateKeyPem` is the decrypted, in-memory
 * PEM string — only the on-disk JSON shape changed.
 */
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  encryptSecret,
  decryptSecret,
  restrictToSystemAndAdministrators,
  type EncryptedSecret,
} from '../security/credential-encryption.js';

export interface AtlasRuntimeIdentity {
  /** Set once /runtime/register succeeds; absent for a not-yet-enrolled identity. */
  runtimeId: string | null;
  publicKeyPem: string;
  privateKeyPem: string;
  /** Machine fingerprint sent at registration — stable across restarts, derived once. */
  fingerprint: string;
}

/** On-disk shape — the private key is only ever persisted encrypted. */
interface PersistedIdentityFile {
  runtimeId: string | null;
  publicKeyPem: string;
  fingerprint: string;
  encryptedPrivateKey: EncryptedSecret;
}

function identityFilePath(dataDir: string): string {
  return join(dataDir, 'atlas-runtime-identity.json');
}

function generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function generateFingerprint(): string {
  // A stable-enough per-install identifier — this is a demo/self-scan
  // Runtime (see docs/ATLAS-RUNTIME-CLIENT.md), not a hardened hardware
  // fingerprint; the protocol only requires FINGERPRINT_DUPLICATE
  // detection to have something stable to compare across registrations.
  return randomUUID();
}

/**
 * Loads the persisted identity from `<dataDir>/atlas-runtime-identity.json`
 * if present, or generates and persists a brand-new Ed25519 keypair +
 * fingerprint. Never overwrites an existing identity file — a Runtime's
 * identity, once created, is stable for the machine's lifetime.
 */
export function loadOrCreateIdentity(dataDir: string): AtlasRuntimeIdentity {
  const filePath = identityFilePath(dataDir);

  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf-8');
    const persisted = JSON.parse(raw) as PersistedIdentityFile;
    return {
      runtimeId: persisted.runtimeId,
      publicKeyPem: persisted.publicKeyPem,
      fingerprint: persisted.fingerprint,
      privateKeyPem: decryptSecret(persisted.encryptedPrivateKey, dataDir),
    };
  }

  const { publicKeyPem, privateKeyPem } = generateKeyPair();
  const identity: AtlasRuntimeIdentity = {
    runtimeId: null,
    publicKeyPem,
    privateKeyPem,
    fingerprint: generateFingerprint(),
  };
  persistIdentity(dataDir, identity);
  return identity;
}

/**
 * Persists the identity (e.g. after registration fills in `runtimeId`).
 * The private key is encrypted before it touches disk (DPAPI on Windows,
 * AES-256-GCM locally otherwise — see `security/credential-encryption.ts`);
 * file-mode (`chmod 0600`, best-effort on POSIX, no-op on Windows) and the
 * Windows ACL restriction below are both a second, independent layer, not
 * the primary protection.
 */
export function persistIdentity(dataDir: string, identity: AtlasRuntimeIdentity): void {
  mkdirSync(dataDir, { recursive: true });
  const filePath = identityFilePath(dataDir);
  const persisted: PersistedIdentityFile = {
    runtimeId: identity.runtimeId,
    publicKeyPem: identity.publicKeyPem,
    fingerprint: identity.fingerprint,
    encryptedPrivateKey: encryptSecret(identity.privateKeyPem, dataDir),
  };
  writeFileSync(filePath, JSON.stringify(persisted, null, 2), 'utf-8');
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Windows / unsupported filesystem — ignored, not a failure.
  }
  try {
    chmodSync(dirname(filePath), 0o700);
  } catch {
    // same as above
  }
  // No-op on non-Windows; on Windows, restricts to SYSTEM + Administrators
  // only — a standard VM user must not be able to open this file.
  restrictToSystemAndAdministrators(filePath);
}
