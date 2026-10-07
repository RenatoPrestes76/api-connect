import { describe, it, expect, beforeAll } from 'vitest';
import pg from 'pg';
import { testErpConnection, type ErpConnectionTarget } from '../connection-test.js';

/**
 * Against a REAL Postgres (docker run postgres:16-alpine, see the
 * command in this session's notes) — not mocked. Skips cleanly if that
 * container isn't reachable (e.g. CI without Docker), rather than
 * failing the whole suite on an environment it can't assume.
 */
const HOST = process.env['ATLAS_TEST_PG_HOST'] ?? 'localhost';
const PORT = Number(process.env['ATLAS_TEST_PG_PORT'] ?? 15432);
const ADMIN_USER = 'testadmin';
const ADMIN_PASSWORD = 'testadmin_pw';
const DATABASE = 'erp_test';

let pgAvailable = false;

beforeAll(async () => {
  const client = new pg.Client({
    host: HOST,
    port: PORT,
    user: ADMIN_USER,
    password: ADMIN_PASSWORD,
    database: DATABASE,
    connectionTimeoutMillis: 2000,
  });
  try {
    await client.connect();
    await client.end();
    pgAvailable = true;
  } catch {
    pgAvailable = false;
  }
});

function target(overrides: Partial<ErpConnectionTarget>): ErpConnectionTarget {
  return {
    dbType: 'postgres',
    host: HOST,
    port: PORT,
    database: DATABASE,
    username: ADMIN_USER,
    password: ADMIN_PASSWORD,
    ...overrides,
  };
}

describe('testErpConnection (real Postgres)', () => {
  it('accepts a real read-only role, real privilege query, no write ever attempted', async () => {
    if (!pgAvailable) return;
    const result = await testErpConnection(
      target({ username: 'atlas_readonly', password: 'readonly_pw' })
    );
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(true);
    expect(result.readOnlySetupSql).toBeUndefined();
  });

  it('refuses a role that can write, and includes the fix-it SQL — no INSERT/UPDATE/DELETE ever issued', async () => {
    if (!pgAvailable) return;

    // Prove no write was attempted: snapshot row count before, compare after.
    const admin = new pg.Client({
      host: HOST,
      port: PORT,
      user: ADMIN_USER,
      password: ADMIN_PASSWORD,
      database: DATABASE,
    });
    await admin.connect();
    const before = await admin.query('SELECT count(*) FROM produtos');

    const result = await testErpConnection(
      target({ username: 'atlas_writer', password: 'writer_pw' })
    );

    const after = await admin.query('SELECT count(*) FROM produtos');
    await admin.end();

    expect(before.rows[0].count).toBe(after.rows[0].count);
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(false);
    expect(result.readOnlySetupSql).toContain('GRANT SELECT ON ALL TABLES IN SCHEMA public');
    expect(result.readOnlySetupSql).not.toContain('INSERT');
  });

  it('refuses the admin/superuser role too (rolsuper check, not just explicit grants)', async () => {
    if (!pgAvailable) return;
    const result = await testErpConnection(target({}));
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(false);
  });

  it('reports a clean, password-free error for wrong credentials', async () => {
    if (!pgAvailable) return;
    const result = await testErpConnection(
      target({ username: 'atlas_readonly', password: 'WRONG-PASSWORD-xyz' })
    );
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('WRONG-PASSWORD-xyz');
    expect(result.error).toContain('Authentication failed');
  });

  it('reports a clean error for an unreachable host, never hangs past the connect timeout', async () => {
    const result = await testErpConnection(
      target({ host: '10.255.255.1', port: 5999, username: 'x', password: 'y' })
    );
    expect(result.ok).toBe(false);
    expect(result.readOnly).toBe(false);
  }, 15_000);

  it('refuses to silently approve a non-postgres dbType', async () => {
    const result = await testErpConnection(target({ dbType: 'mysql' }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('mysql');
    expect(result.error).toContain('manually');
  });
});
