import { describe, it, expect, beforeAll } from 'vitest';
import pg from 'pg';
import { testErpConnection, type ErpConnectionTarget } from '../connection-test.js';

/**
 * Against a REAL Postgres — not mocked. Bring one up with:
 *
 *   docker run -d --name atlas_test_pg -e POSTGRES_USER=testadmin \
 *     -e POSTGRES_PASSWORD=testadmin_pw -e POSTGRES_DB=erp_test \
 *     -p 15432:5432 postgres:16-alpine
 *
 * `beforeAll` below then idempotently provisions every role/table this
 * file needs directly against that admin connection — nothing is
 * assumed to pre-exist, so a fresh container is enough. Skips cleanly
 * if the container isn't reachable (e.g. CI without Docker), rather
 * than failing the whole suite on an environment it can't assume.
 */
const HOST = process.env['ATLAS_TEST_PG_HOST'] ?? 'localhost';
const PORT = Number(process.env['ATLAS_TEST_PG_PORT'] ?? 15432);
const ADMIN_USER = 'testadmin';
const ADMIN_PASSWORD = 'testadmin_pw';
const DATABASE = 'erp_test';

let pgAvailable = false;

const PROVISION_SQL = `
  CREATE TABLE IF NOT EXISTS produtos (id serial primary key, nome text);
  INSERT INTO produtos (nome) SELECT 'Produto Teste' WHERE NOT EXISTS (SELECT 1 FROM produtos);

  DO $$ BEGIN
    CREATE ROLE atlas_readonly WITH LOGIN PASSWORD 'readonly_pw';
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  GRANT CONNECT ON DATABASE erp_test TO atlas_readonly;
  GRANT USAGE ON SCHEMA public TO atlas_readonly;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO atlas_readonly;

  DO $$ BEGIN
    CREATE ROLE atlas_writer WITH LOGIN PASSWORD 'writer_pw';
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  GRANT CONNECT ON DATABASE erp_test TO atlas_writer;
  GRANT USAGE ON SCHEMA public TO atlas_writer;
  GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO atlas_writer;

  -- A NOLOGIN "group" role holding the only direct write grant, plus a
  -- LOGIN role that only inherits it via membership — proves the
  -- read-only check follows role membership, not just direct grants.
  DO $$ BEGIN
    CREATE ROLE atlas_write_group NOLOGIN;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  GRANT INSERT, UPDATE, DELETE ON produtos TO atlas_write_group;

  DO $$ BEGIN
    CREATE ROLE atlas_inherited_writer WITH LOGIN PASSWORD 'inherited_pw';
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  GRANT atlas_write_group TO atlas_inherited_writer;
  GRANT CONNECT ON DATABASE erp_test TO atlas_inherited_writer;

  -- Owns a table with zero explicit GRANTs on it — ownership alone
  -- gives full implicit privileges in Postgres.
  DO $$ BEGIN
    CREATE ROLE atlas_table_owner WITH LOGIN PASSWORD 'owner_pw';
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  GRANT CONNECT ON DATABASE erp_test TO atlas_table_owner;
  CREATE TABLE IF NOT EXISTS owned_by_tester (id serial primary key, note text);
  ALTER TABLE owned_by_tester OWNER TO atlas_table_owner;

  -- Only SELECT on existing tables, but CREATE on the schema — can
  -- create (and own) new tables even with no write grant today.
  DO $$ BEGIN
    CREATE ROLE atlas_schema_creator WITH LOGIN PASSWORD 'creator_pw';
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  GRANT CONNECT ON DATABASE erp_test TO atlas_schema_creator;
  GRANT USAGE, CREATE ON SCHEMA public TO atlas_schema_creator;
  GRANT SELECT ON produtos TO atlas_schema_creator;
`;

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
    await client.query(PROVISION_SQL);
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
    expect(result.readOnlyViolation).toContain('superuser');
  });

  it('refuses a role that only inherits write access through another role — never granted directly', async () => {
    if (!pgAvailable) return;
    // atlas_inherited_writer has zero direct grants on any table; its only
    // INSERT/UPDATE/DELETE privilege comes from membership in
    // atlas_write_group. A check scoped to
    // `role_table_grants.grantee = current_user` would miss this entirely
    // and wrongly call it read-only.
    const result = await testErpConnection(
      target({ username: 'atlas_inherited_writer', password: 'inherited_pw' })
    );
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(false);
    expect(result.readOnlyViolation).toContain('inherited');
    expect(result.readOnlySetupSql).toContain('GRANT SELECT ON ALL TABLES IN SCHEMA public');
  });

  it('refuses a role that owns a table, even with zero explicit GRANTs on it', async () => {
    if (!pgAvailable) return;
    // atlas_table_owner owns `owned_by_tester` with no GRANT rows at all —
    // ownership alone gives full implicit privileges in Postgres.
    const result = await testErpConnection(
      target({ username: 'atlas_table_owner', password: 'owner_pw' })
    );
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(false);
    expect(result.readOnlyViolation).toContain('owns');
  });

  it('refuses a role with CREATE on a schema, even with only SELECT on existing tables', async () => {
    if (!pgAvailable) return;
    // atlas_schema_creator has only SELECT on `produtos` — no write grant
    // on any existing table — but CREATE on schema public, letting it
    // create (and then own) new tables.
    const result = await testErpConnection(
      target({ username: 'atlas_schema_creator', password: 'creator_pw' })
    );
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(false);
    expect(result.readOnlyViolation).toContain('CREATE');
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
