/**
 * PostgreSQL integration tests.
 * Requires Docker containers from docker/docker-compose.yml to be running.
 * Run: pnpm test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresDriver } from '../../drivers/postgres.driver.js';
import { QueryBuilder } from '../../query/query-builder.js';
import { equals } from '../../query/filters.js';
import type { DriverConfig } from '../../connection/connection-options.js';

const cfg: DriverConfig = {
  host: process.env['PG_HOST'] ?? 'localhost',
  port: Number(process.env['PG_PORT'] ?? 5433),
  database: process.env['PG_DATABASE'] ?? 'testdb',
  username: process.env['PG_USER'] ?? 'testuser',
  password: process.env['PG_PASSWORD'] ?? 'testpass',
};

describe('PostgreSQL integration', () => {
  const driver = new PostgresDriver(cfg);

  beforeAll(async () => {
    await driver.connect();
  });

  afterAll(async () => {
    await driver.disconnect();
  });

  // ─── Connectivity ────────────────────────────────────────────────────────────

  it('connects and reports healthy', async () => {
    const h = await driver.health();
    expect(h.connected).toBe(true);
    expect(h.status).toBe('healthy');
    expect(h.databaseVersion).toMatch(/PostgreSQL/i);
    expect(h.latency).toBeGreaterThanOrEqual(0);
    expect(typeof h.poolUsage).toBe('number');
  });

  // ─── Query execution ─────────────────────────────────────────────────────────

  it('executes raw SELECT 1', async () => {
    const q = QueryBuilder.raw('SELECT 1 AS value', []);
    const rows = await driver.execute<{ value: number }>(q);
    expect(rows[0]?.value).toBe(1);
  });

  it('executes SELECT from users table', async () => {
    const q = new QueryBuilder().from('users').limit(10).build();
    const rows = await driver.execute<{ id: number; email: string }>(q);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('email');
  });

  it('executes SELECT with WHERE filter', async () => {
    const q = new QueryBuilder().from('users').where(equals('email', 'alice@example.com')).build();
    const rows = await driver.execute<{ name: string }>(q);
    expect(rows[0]?.name).toBe('Alice');
  });

  it('executes SELECT with LIMIT and OFFSET', async () => {
    const q = new QueryBuilder().from('users').limit(1).offset(0).build();
    const rows = await driver.execute(q);
    expect(rows).toHaveLength(1);
  });

  // ─── Schema discovery ────────────────────────────────────────────────────────

  it('discovers schema with users and orders tables', async () => {
    const schema = await driver.schema();
    const names = schema.tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('orders');
  });

  it('discovers users table columns', async () => {
    const schema = await driver.schema();
    const users = schema.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();
    const colNames = users!.columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('email');
  });

  it('discovers foreign key relation', async () => {
    const schema = await driver.schema();
    expect(schema.relations.length).toBeGreaterThan(0);
    const rel = schema.relations.find((r) => r.fromTable === 'orders' && r.toTable === 'users');
    expect(rel).toBeDefined();
  });

  it('listTables returns table names', async () => {
    const tables = await driver.listTables();
    expect(tables).toContain('users');
    expect(tables).toContain('orders');
  });

  it('readTable returns the specific table', async () => {
    const table = await driver.readTable('users');
    expect(table).not.toBeNull();
    expect(table!.name).toBe('users');
  });

  it('readTable returns null for missing table', async () => {
    const table = await driver.readTable('does_not_exist');
    expect(table).toBeNull();
  });

  // ─── Transactions ────────────────────────────────────────────────────────────

  it('transaction commits on success', async () => {
    const result = await driver.transaction(async () => {
      const rows = await driver.execute<{ value: number }>(QueryBuilder.raw('SELECT 1 AS value'));
      return rows[0]?.value;
    });
    expect(result).toBe(1);
  });

  it('transaction rolls back on error', async () => {
    await expect(
      driver.transaction(async () => {
        throw new Error('intentional rollback');
      })
    ).rejects.toThrow('Transaction rolled back');
  });

  // ─── Reconnect ───────────────────────────────────────────────────────────────

  it('reconnect restores connectivity', async () => {
    await driver.reconnect();
    expect(driver.isConnected).toBe(true);
    const h = await driver.health();
    expect(h.connected).toBe(true);
  });
});
