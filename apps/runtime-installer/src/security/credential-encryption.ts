/**
 * At-rest encryption for secrets this installer persists on the target
 * machine (`runtimeToken` in `config/runtime-config.ts` today). Before this
 * module existed, every secret was written to disk as plain text (see the
 * audit at docs/ATLAS-AUDIT-REPORT.md) — anyone with filesystem read access
 * to the runtime root could read the cloud auth token directly.
 *
 * On Windows (the OS this installer's `service/windows-service.ts` targets)
 * this shells out to `System.Security.Cryptography.ProtectedData` (DPAPI,
 * `CurrentUser` scope) via PowerShell — the OS-native mechanism, no extra
 * native dependency. On any other OS (`service/linux-service.ts` also
 * exists) there is no DPAPI equivalent without a new native dependency, so
 * this falls back to AES-256-GCM with a key held in a dedicated, 0600 local
 * key file next to the data it protects — genuine encryption-at-rest, but
 * the key lives on the same disk as the ciphertext, unlike DPAPI.
 *
 * Deliberately duplicated rather than shared with apps/agent's identical
 * module: this installer and apps/agent are sibling apps with separate
 * enrollment protocols (see docs/ATLAS-RUNTIME-CLIENT-AUDIT.md), matching
 * this repo's existing convention of re-implementing small protocol/crypto
 * primitives per app instead of adding a cross-app dependency for them
 * (see atlas-runtime-client/protocol.ts's own rationale comment).
 */
import { execFileSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

export type EncryptionScheme = 'dpapi' | 'aes-256-gcm-local';

export interface EncryptedSecret {
  scheme: EncryptionScheme;
  /** base64 */
  ciphertext: string;
}

const LOCAL_KEY_FILE = '.local-encryption-key';
const AES_ALGORITHM = 'aes-256-gcm';
const AES_IV_LENGTH = 12;
const AES_TAG_LENGTH = 16;

// ─── DPAPI (Windows only) ───────────────────────────────────────────────────

function runPowerShell(script: string): string {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf-8',
  }).trim();
}

/** `plaintext`'s base64 is interpolated into the script — safe, base64's alphabet has no PowerShell-special characters. */
function dpapiProtect(plaintext: Buffer): Buffer {
  const script = [
    'Add-Type -AssemblyName System.Security',
    `$bytes = [Convert]::FromBase64String('${plaintext.toString('base64')}')`,
    '$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Convert]::ToBase64String($protected)',
  ].join('; ');
  return Buffer.from(runPowerShell(script), 'base64');
}

function dpapiUnprotect(ciphertext: Buffer): Buffer {
  const script = [
    'Add-Type -AssemblyName System.Security',
    `$bytes = [Convert]::FromBase64String('${ciphertext.toString('base64')}')`,
    '$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Convert]::ToBase64String($plain)',
  ].join('; ');
  return Buffer.from(runPowerShell(script), 'base64');
}

// ─── AES-256-GCM fallback (non-Windows) ─────────────────────────────────────

function localKeyPath(dataDir: string): string {
  return join(dataDir, LOCAL_KEY_FILE);
}

function loadOrCreateLocalKey(dataDir: string): Buffer {
  const keyPath = localKeyPath(dataDir);
  if (existsSync(keyPath)) {
    return Buffer.from(readFileSync(keyPath, 'utf-8').trim(), 'base64');
  }

  mkdirSync(dataDir, { recursive: true });
  const key = randomBytes(32);
  writeFileSync(keyPath, key.toString('base64'), { encoding: 'utf-8', mode: 0o600 });
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    // Unsupported filesystem — same best-effort posture as the rest of this installer.
  }
  return key;
}

function aesEncrypt(plaintext: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(AES_IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function aesDecrypt(payload: Buffer, key: Buffer): Buffer {
  const iv = payload.subarray(0, AES_IV_LENGTH);
  const tag = payload.subarray(AES_IV_LENGTH, AES_IV_LENGTH + AES_TAG_LENGTH);
  const encrypted = payload.subarray(AES_IV_LENGTH + AES_TAG_LENGTH);
  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ─── Public, platform-dispatching API ───────────────────────────────────────

/**
 * Encrypts `plaintext` for storage under `dataDir`. `dataDir` is only used
 * by the non-Windows fallback (to hold the local AES key) — DPAPI needs no
 * key of its own to manage.
 */
export function encryptSecret(plaintext: string, dataDir: string): EncryptedSecret {
  const plainBuffer = Buffer.from(plaintext, 'utf-8');
  if (process.platform === 'win32') {
    return { scheme: 'dpapi', ciphertext: dpapiProtect(plainBuffer).toString('base64') };
  }
  const key = loadOrCreateLocalKey(dataDir);
  return {
    scheme: 'aes-256-gcm-local',
    ciphertext: aesEncrypt(plainBuffer, key).toString('base64'),
  };
}

export function decryptSecret(secret: EncryptedSecret, dataDir: string): string {
  const cipherBuffer = Buffer.from(secret.ciphertext, 'base64');
  if (secret.scheme === 'dpapi') {
    return dpapiUnprotect(cipherBuffer).toString('utf-8');
  }
  const key = loadOrCreateLocalKey(dataDir);
  return aesDecrypt(cipherBuffer, key).toString('utf-8');
}

// Exported for direct, platform-independent testing of each scheme.
export const _internal = {
  dpapiProtect,
  dpapiUnprotect,
  aesEncrypt,
  aesDecrypt,
  loadOrCreateLocalKey,
};
