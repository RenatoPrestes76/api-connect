/**
 * Executes a discovery job by performing a real schema introspection
 * through GENESIS (`@seltriva/database-sdk`'s `PostgresDriver`) — no
 * fixture, no fake data, and no new ERP engine: this reuses the exact
 * driver/schema-reader Atlas already ships, exactly as
 * docs/ATLAS-RUNTIME-CLIENT-AUDIT.md's Fase 7 decision records.
 *
 * There is no real customer ERP reachable from this environment, so the
 * scan target is a real, already-running Postgres instance configured via
 * env vars (see docs/ATLAS-RUNTIME-CLIENT.md) — the introspection result
 * itself is genuine, only the *choice of target* is a stand-in for a real
 * ERP connection.
 */
import { PostgresDriver, type DatabaseSchema } from '@seltriva/database-sdk';

export interface ScanTargetConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export async function executeDiscoveryScan(target: ScanTargetConfig): Promise<DatabaseSchema> {
  const driver = new PostgresDriver({
    host: target.host,
    port: target.port,
    database: target.database,
    username: target.username,
    password: target.password,
    ssl: target.ssl ?? false,
    timeout: 10_000,
  });

  await driver.connect();
  try {
    return await driver.readSchema();
  } finally {
    await driver.disconnect();
  }
}
