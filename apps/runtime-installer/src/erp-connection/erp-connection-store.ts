/**
 * Persists the ERP connection the wizard just collected and validated
 * (connection-test.ts) — password encrypted at rest (DPAPI LocalMachine
 * on Windows, same scheme/scope as everything else in security/
 * credential-encryption.ts, for the same "installer writes, service
 * account reads" reason), file ACL-restricted to SYSTEM + Administrators.
 *
 * This is the ONLY place ERP credentials are written on the client
 * machine, and — by design — the only place they ever exist at all: the
 * cloud's connection profile (apps/api's erp-connectivity module) never
 * receives or stores a password. See docs/ATLAS-RUNTIME-CLIENT.md's
 * "ERP credentials never leave the client machine".
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  encryptSecret,
  restrictToSystemAndAdministrators,
  type EncryptedSecret,
} from '../security/credential-encryption.js';
import type { ErpConnectionTarget } from './connection-test.js';

export interface StoredErpConnection {
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  encryptedPassword: EncryptedSecret;
}

/**
 * `dataDir` is only used by the non-Windows AES-256-GCM fallback (to
 * hold its local key file) — pass the same directory the file itself
 * lives in, matching identity.ts's convention.
 */
export function writeErpConnection(filePath: string, target: ErpConnectionTarget): void {
  const dataDir = dirname(filePath);
  mkdirSync(dataDir, { recursive: true });
  const stored: StoredErpConnection = {
    dbType: target.dbType,
    host: target.host,
    port: target.port,
    database: target.database,
    username: target.username,
    encryptedPassword: encryptSecret(target.password, dataDir),
  };
  writeFileSync(filePath, JSON.stringify(stored, null, 2), 'utf-8');
  restrictToSystemAndAdministrators(filePath);
}
