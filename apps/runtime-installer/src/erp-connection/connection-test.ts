/**
 * Validates an ERP database connection the installer wizard just
 * collected, BEFORE it's encrypted and stored (see erp-connection-
 * store.ts) — two checks, neither of which ever attempts a real write:
 *
 * 1. Can we even connect with these credentials?
 * 2. Is this role read-only? Checked by querying Postgres' own
 *    privilege catalogs — never by trying an INSERT/UPDATE/DELETE and
 *    seeing what happens. A role that CAN write is refused outright,
 *    with the exact SQL to fix it (the same SQL already documented in
 *    docs/ATLAS-RUNTIME-CLIENT.md's "Database access requirements").
 *
 *    The read-only check uses `has_table_privilege()` rather than
 *    filtering `information_schema.role_table_grants` by
 *    `grantee = current_user` — the latter only sees privileges granted
 *    directly to the role by name, and misses two real ways a role can
 *    still write:
 *      - Privilege inherited through membership in another role (e.g.
 *        `GRANT writer_group TO this_user`, with the actual INSERT/
 *        UPDATE/DELETE grants on `writer_group`, not `this_user`).
 *        `has_table_privilege()` walks that membership chain.
 *      - Table ownership: an owner has full implicit privileges on
 *        their own tables with no GRANT row to find at all. Checked
 *        both via `has_table_privilege` (which also returns true for
 *        owners) and via an explicit `relowner` check, so a refusal can
 *        say "this user owns N table(s)" rather than a generic
 *        "has write access".
 *    Also refuses a role with CREATE on any non-system schema — able to
 *    create new tables (and own them) even with zero privileges on
 *    existing ones today.
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
  /** Present when `ok` is true but `readOnly` is false — which check(s) failed, in plain language. */
  readOnlyViolation?: string;
  /** Present when `ok` is true but `readOnly` is false — the exact SQL to create a correctly-scoped role instead. */
  readOnlySetupSql?: string;
}

const READ_ONLY_PRIVILEGE_CHECK_SQL = `
  WITH target_tables AS (
    SELECT c.oid, c.relowner
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  )
  SELECT
    (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
    EXISTS (
      SELECT 1 FROM target_tables
      WHERE relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
    ) AS owns_table,
    EXISTS (
      SELECT 1 FROM target_tables t
      WHERE has_table_privilege(current_user, t.oid, 'INSERT')
         OR has_table_privilege(current_user, t.oid, 'UPDATE')
         OR has_table_privilege(current_user, t.oid, 'DELETE')
         OR has_table_privilege(current_user, t.oid, 'TRUNCATE')
    ) AS has_write_grant,
    EXISTS (
      SELECT 1 FROM pg_catalog.pg_namespace n
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND has_schema_privilege(current_user, n.nspname, 'CREATE')
    ) AS can_create_in_schema
`;

/**
 * Picks the clearest single reason to show the operator, checked in
 * order from most to least severe. Returns undefined when none apply
 * (the role is genuinely read-only).
 */
function describeReadOnlyViolation(row: {
  is_superuser: boolean | null;
  owns_table: boolean;
  has_write_grant: boolean;
  can_create_in_schema: boolean;
}): string | undefined {
  if (row.is_superuser) {
    return 'This user is a Postgres superuser, which bypasses all privilege checks.';
  }
  if (row.owns_table) {
    return 'This user owns one or more tables — table owners always have full implicit privileges on them, regardless of GRANTs.';
  }
  if (row.has_write_grant) {
    return 'This user can INSERT, UPDATE, DELETE, or TRUNCATE at least one table — either by a direct GRANT or inherited through membership in another role.';
  }
  if (row.can_create_in_schema) {
    return 'This user has CREATE privilege on at least one schema, which lets it create (and then own) new tables.';
  }
  return undefined;
}

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
    const result = await client.query<{
      is_superuser: boolean | null;
      owns_table: boolean;
      has_write_grant: boolean;
      can_create_in_schema: boolean;
    }>(READ_ONLY_PRIVILEGE_CHECK_SQL);
    const row = result.rows[0];
    const violation = describeReadOnlyViolation(row);
    return violation
      ? {
          ok: true,
          readOnly: false,
          readOnlyViolation: violation,
          readOnlySetupSql: readOnlySetupSqlFor(target),
        }
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
