/**
 * Validates an ERP database connection the installer wizard just
 * collected, BEFORE it's encrypted and stored (see erp-connection-
 * store.ts) — two checks, neither of which ever attempts a real write:
 *
 * 1. Can we even connect with these credentials?
 * 2. Is this role read-only? Checked by querying Postgres' own
 *    privilege catalogs (pg_roles.rolsuper,
 *    information_schema.role_table_grants) — never by trying an
 *    INSERT/UPDATE/DELETE and seeing what happens. A role that CAN
 *    write is refused outright, with the exact SQL to fix it (the same
 *    SQL already documented in docs/ATLAS-RUNTIME-CLIENT.md's "Database
 *    access requirements").
 *
 * Only Postgres is implemented for real — it's the only engine
 * apps/agent's executor.ts actually exercises today (see
 * docs/ATLAS-AUDIT-REPORT.md). Other dbTypes are accepted by the wizard
 * (for forward compatibility / operator record-keeping) but this
 * refuses to silently claim a check it can't perform.
 */
import pg from 'pg';

export interface ErpConnectionTarget {
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  /** Only meaningful when `ok` is true. */
  readOnly: boolean;
  error?: string;
  /** Present when `ok` is true but `readOnly` is false — the exact SQL to create a correctly-scoped role instead. */
  readOnlySetupSql?: string;
}

const READ_ONLY_PRIVILEGE_CHECK_SQL = `
  SELECT
    (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
    EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE grantee = current_user
        AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) AS has_write_grant
`;

function readOnlySetupSqlFor(target: ErpConnectionTarget): string {
  return [
    `CREATE ROLE ${target.username}_readonly WITH LOGIN PASSWORD '...';`,
    `GRANT CONNECT ON DATABASE ${target.database} TO ${target.username}_readonly;`,
    `GRANT USAGE ON SCHEMA public TO ${target.username}_readonly;`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${target.username}_readonly;`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${target.username}_readonly;`,
  ].join('\n');
}

/**
 * Never includes `target.password` — only host/port/database/username,
 * which are not secrets by themselves. `pg`'s own connection errors
 * (ECONNREFUSED, password authentication failed, etc.) don't echo the
 * password either, but this never forwards the raw driver error message
 * verbatim, as a second, independent guarantee.
 */
function describeConnectionFailure(target: ErpConnectionTarget, err: unknown): string {
  const code = (err as { code?: string } | undefined)?.code;
  const where = `${target.host}:${target.port}/${target.database}`;
  if (code === 'ECONNREFUSED') return `Connection refused at ${where}.`;
  if (code === 'ENOTFOUND') return `Host not found: ${target.host}.`;
  if (code === '28P01') return `Authentication failed for user "${target.username}" at ${where}.`;
  if (code === '3D000')
    return `Database "${target.database}" does not exist at ${target.host}:${target.port}.`;
  return `Could not connect to ${where} as "${target.username}".`;
}

async function testPostgresConnection(target: ErpConnectionTarget): Promise<ConnectionTestResult> {
  const client = new pg.Client({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.username,
    password: target.password,
    ssl: target.ssl ?? false,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
  } catch (err) {
    return { ok: false, readOnly: false, error: describeConnectionFailure(target, err) };
  }

  try {
    const result = await client.query<{ is_superuser: boolean | null; has_write_grant: boolean }>(
      READ_ONLY_PRIVILEGE_CHECK_SQL
    );
    const row = result.rows[0];
    const canWrite = Boolean(row?.is_superuser) || Boolean(row?.has_write_grant);
    return canWrite
      ? { ok: true, readOnly: false, readOnlySetupSql: readOnlySetupSqlFor(target) }
      : { ok: true, readOnly: true };
  } catch (err) {
    return {
      ok: false,
      readOnly: false,
      error: `Connected, but could not verify read-only privileges: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function testErpConnection(
  target: ErpConnectionTarget
): Promise<ConnectionTestResult> {
  if (target.dbType !== 'postgres') {
    return {
      ok: false,
      readOnly: false,
      error: `Automatic connection/read-only verification isn't implemented yet for "${target.dbType}" — only postgres today. You must manually confirm the user is read-only before continuing.`,
    };
  }
  return testPostgresConnection(target);
}
