/**
 * Reads the ERP connection the installer collected, tested, and
 * encrypted at rest (apps/runtime-installer/src/erp-connection/
 * erp-connection-store.ts) — the ONLY source of ERP credentials for
 * this daemon. There is no ATLAS_SCAN_DB_* env-var path anymore: a
 * plaintext password in the Windows service's env block (visible in the
 * WinSW-generated XML) was the gap Sprint A2.6 closed. See
 * docs/ATLAS-RUNTIME-CLIENT.md's "ERP credentials never leave the
 * client machine".
 *
 * Deliberately duplicated rather than shared with the installer's
 * identical-shaped module — same convention as security/credential-
 * encryption.ts's own duplication (see that module's header comment).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decryptSecret, type EncryptedSecret } from '../security/credential-encryption.js';
import type { ScanTargetConfig } from './executor.js';

interface StoredErpConnection {
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  encryptedPassword: EncryptedSecret;
}

/**
 * Returns undefined (not a throw) when the file is absent — matches
 * ATLAS_SCAN_DB_HOST's old "optional" posture: a Runtime with no ERP
 * configured yet still enrolls/heartbeats normally, just reports any
 * assigned discovery job as failed (run.ts's existing "No scan target
 * configured" branch).
 */
export function loadErpScanTarget(filePath: string): ScanTargetConfig | undefined {
  if (!existsSync(filePath)) return undefined;

  const stored = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredErpConnection;
  if (stored.dbType !== 'postgres') {
    // executor.ts only ever exercises PostgresDriver today (see its own
    // header comment) — never silently treat another engine as postgres.
    return undefined;
  }

  return {
    host: stored.host,
    port: stored.port,
    database: stored.database,
    username: stored.username,
    password: decryptSecret(stored.encryptedPassword, dirname(filePath)),
  };
}
