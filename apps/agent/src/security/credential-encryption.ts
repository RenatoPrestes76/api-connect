/**
 * At-rest encryption for secrets persisted on the machine running this
 * Runtime (the Ed25519 private key in `atlas-runtime-client/identity.ts`
 * today). Before this module existed, every secret was written to disk as
 * plain text (see the audit at docs/ATLAS-AUDIT-REPORT.md) — anyone with
 * filesystem read access to the data dir could read the private key
 * directly, with no further step required.
 *
 * On Windows (the target client OS — see apps/runtime-installer's
 * `service/windows-service.ts`) this shells out to
 * `System.Security.Cryptography.ProtectedData` (DPAPI) via PowerShell —
 * the OS-native mechanism, no native npm dependency needed. Scope is
 * `LocalMachine`, not `CurrentUser`: the Runtime runs as a Windows
 * service (LocalSystem or a dedicated service account), while whatever
 * wrote the identity/config file first (an interactive install, or the
 * service's own first run under its own account) may not be the same
 * Windows user token that later reads it back. `CurrentUser`-scoped
 * ciphertext is only decryptable by the exact account that encrypted it —
 * `LocalMachine` is decryptable by any process on this machine, which is
 * the correct trade for "installer writes, service account reads".
 *
 * The secret itself is never passed as a PowerShell command-line argument
 * (visible to other processes/users via the process list, e.g. `Get-
 * Process`, Task Manager's command-line column, or Sysmon/Event ID 4688)
 * — it's written to the child process's stdin instead, and the script
 * only ever appears in argv as a fixed, secret-independent string.
 *
 * On any other OS (the installer also supports Linux — see
 * `service/linux-service.ts`) there is no DPAPI equivalent available
 * without a new native dependency, so this falls back to AES-256-GCM with
 * a key held in a dedicated, 0600 local key file next to the data it
 * protects. This is genuine encryption-at-rest, but — unlike DPAPI — the
 * key lives on the same disk as the ciphertext; it stops a casual file
 * copy/backup leak, not an attacker with full read access to that same
 * machine's filesystem as the runtime's own user.
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

/** `LocalMachine`, not `CurrentUser` — see the module comment above for why. */
const DPAPI_SCOPE = 'LocalMachine';

/** The secret travels over stdin; `script` itself never depends on secret bytes. */
function runPowerShell(script: string, stdinInput: string): string {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf-8',
    input: stdinInput,
  }).trim();
}

function dpapiProtect(plaintext: Buffer): Buffer {
  const script = [
    'Add-Type -AssemblyName System.Security',
    '$b64 = [Console]::In.ReadToEnd().Trim()',
    '$bytes = [Convert]::FromBase64String($b64)',
    `$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::${DPAPI_SCOPE})`,
    '[Convert]::ToBase64String($protected)',
  ].join('; ');
  return Buffer.from(runPowerShell(script, plaintext.toString('base64')), 'base64');
}

function dpapiUnprotect(ciphertext: Buffer): Buffer {
  const script = [
    'Add-Type -AssemblyName System.Security',
    '$b64 = [Console]::In.ReadToEnd().Trim()',
    '$bytes = [Convert]::FromBase64String($b64)',
    `$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::${DPAPI_SCOPE})`,
    '[Convert]::ToBase64String($plain)',
  ].join('; ');
  return Buffer.from(runPowerShell(script, ciphertext.toString('base64')), 'base64');
}

/**
 * Restricts `filePath`'s NTFS ACL to SYSTEM and Administrators only —
 * defense-in-depth alongside DPAPI, not a replacement for it: the
 * LocalMachine-scoped ciphertext is already useless off this machine, but
 * without this a standard, non-admin user on the SAME machine could still
 * open the file and read the DPAPI blob (not the plaintext, but still
 * more exposure than necessary). Uses well-known SIDs (S-1-5-18 = SYSTEM,
 * S-1-5-32-544 = Administrators) instead of localized account names,
 * since "Administrators"/"SYSTEM" as display strings don't exist on
 * non-English Windows installs. Best-effort: a failure here must not
 * block identity persistence, the same posture as the chmod(0600) calls
 * elsewhere in this module and in identity.ts.
 */
export function restrictToSystemAndAdministrators(filePath: string): void {
  if (process.platform !== 'win32') return;
  try {
    execFileSync(
      'icacls.exe',
      [filePath, '/inheritance:r', '/grant:r', '*S-1-5-18:F', '*S-1-5-32-544:F'],
      { stdio: 'ignore' }
    );
  } catch {
    // best-effort — see doc comment above.
  }
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
    // Unsupported filesystem — same best-effort posture as identity.ts.
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
  DPAPI_SCOPE,
};
