/**
 * Sprint 27 — SIGMA · Integration tests
 *
 * Requires Docker ERP database:
 *   cd connectors/erp-provider/docker && docker compose up -d
 *
 * Run with: pnpm test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ErpConnector } from '../../provider.js';
import { makeContext } from '../helpers.js';
import type { SyncContext } from '@seltriva/connector-sdk';

const ERP_CONFIG = {
  host: process.env['ERP_HOST'] ?? 'localhost',
  port: Number(process.env['ERP_PORT'] ?? 5435),
  database: process.env['ERP_DATABASE'] ?? 'erp_seltriva',
  username: process.env['ERP_USERNAME'] ?? 'erp_user',
  password: process.env['ERP_PASSWORD'] ?? 'erp_pass',
  ssl: false,
  timeout: 10_000,
};

function job(overrides: Partial<SyncContext> = {}): SyncContext {
  return { jobId: `integration-${Date.now()}`, ...overrides };
}

let connector: ErpConnector;

beforeAll(async () => {
  connector = new ErpConnector(makeContext('integration-erp', ERP_CONFIG));
  const res = await connector.connect();
  if (!res.ok) {
    throw new Error(
      `Could not connect to ERP Docker database at ${ERP_CONFIG.host}:${ERP_CONFIG.port}. ` +
        `Start it with: cd connectors/erp-provider/docker && docker compose up -d\n` +
        `Error: ${res.error?.message}`
    );
  }
});

afterAll(async () => {
  await connector.disconnect();
});

// ── Discovery ─────────────────────────────────────────────────────────────────

describe('Discovery (real ERP schema)', () => {
  it('discovers at least 6 entity types from the ERP schema', async () => {
    const res = await connector.discover();
    expect(res.ok).toBe(true);
    expect(res.data!.entities.length).toBeGreaterThanOrEqual(6);
  });

  it('discovers products, customers, and inventory entities', async () => {
    const res = await connector.discover();
    const names = res.data!.entities.map((e) => e.name);
    expect(names).toContain('products');
    expect(names).toContain('customers');
    expect(names).toContain('inventory');
  });

  it('entity extra.table points to the resolved Portuguese table name', async () => {
    const res = await connector.discover();
    const prod = res.data!.entities.find((e) => e.name === 'products')!;
    expect(prod.extra?.['table']).toBe('produtos');
    const cust = res.data!.entities.find((e) => e.name === 'customers')!;
    expect(cust.extra?.['table']).toBe('clientes');
  });

  it('entity extra.columns is a positive number', async () => {
    const res = await connector.discover();
    for (const e of res.data!.entities) {
      expect(e.extra?.['columns']).toBeGreaterThan(0);
    }
  });
});

// ── Products sync ─────────────────────────────────────────────────────────────

describe('Products sync (real data)', () => {
  it('syncs all 30 seeded products', async () => {
    const { result } = await connector['_products'].sync(job());
    expect(result.synced).toBe(30);
    expect(result.failed).toBe(0);
  });

  it('active flag is mapped correctly', async () => {
    const { products } = await connector['_products'].sync(job());
    const inactive = products.filter((p) => !p.isActive);
    expect(inactive.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(typeof p.isActive).toBe('boolean');
    }
  });

  it('prices are positive numbers', async () => {
    const { products } = await connector['_products'].sync(job());
    for (const p of products) {
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it('incremental sync returns only recently modified products', async () => {
    const cutoff = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago
    const { result } = await connector['_products'].sync(job({ since: cutoff }));
    // seed sets 2 products modified 1 hour ago
    expect(result.synced).toBeGreaterThanOrEqual(2);
    expect(result.synced).toBeLessThan(30);
  });
});

// ── Customers sync ────────────────────────────────────────────────────────────

describe('Customers sync (real data)', () => {
  it('syncs all 15 seeded customers', async () => {
    const { result } = await connector['_customers'].sync(job());
    expect(result.synced).toBe(15);
    expect(result.failed).toBe(0);
  });

  it('Brazilian tax IDs are mapped correctly', async () => {
    const { customers } = await connector['_customers'].sync(job());
    const withTaxId = customers.filter((c) => c.taxId.length > 0);
    expect(withTaxId.length).toBeGreaterThan(0);
  });

  it('credit limits are non-negative', async () => {
    const { customers } = await connector['_customers'].sync(job());
    for (const c of customers) {
      expect(c.creditLimit).toBeGreaterThanOrEqual(0);
    }
  });

  it('incremental sync returns only recently modified customers', async () => {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const { result } = await connector['_customers'].sync(job({ since: cutoff }));
    // seed sets 1 customer modified 30 min ago
    expect(result.synced).toBeGreaterThanOrEqual(1);
    expect(result.synced).toBeLessThan(15);
  });
});

// ── Inventory sync ────────────────────────────────────────────────────────────

describe('Inventory sync (real data + JOIN)', () => {
  it('syncs all seeded inventory entries with qtd_atual > 0', async () => {
    const { result } = await connector['_inventory'].sync(job());
    expect(result.synced).toBeGreaterThanOrEqual(28);
    expect(result.failed).toBe(0);
  });

  it('available = qtd_atual - qtd_reservada for every entry', async () => {
    const { inventory } = await connector['_inventory'].sync(job());
    for (const item of inventory) {
      expect(item.available).toBe(item.total - item.reserved);
    }
  });

  it('externalId format is productCode:depositoId', async () => {
    const { inventory } = await connector['_inventory'].sync(job());
    for (const item of inventory) {
      expect(item.externalId).toMatch(/.+:.+/);
    }
  });

  it('productId is always prefixed with product:', async () => {
    const { inventory } = await connector['_inventory'].sync(job());
    for (const item of inventory) {
      expect(item.productId).toMatch(/^product:/);
    }
  });
});

// ── Full connector lifecycle ──────────────────────────────────────────────────

describe('Full synchronize() pipeline', () => {
  it('completes full sync and returns totals > 0', async () => {
    const res = await connector.synchronize(job());
    expect(res.ok).toBe(true);
    expect(res.data!.synced).toBeGreaterThan(0);
    expect(res.data!.failed).toBe(0);
  });

  it('emits sync.started and sync.finished events', async () => {
    const ctx = makeContext('int-events', ERP_CONFIG);
    const conn = new ErpConnector(ctx);
    await conn.connect();
    const started = [] as unknown[];
    const finished = [] as unknown[];
    ctx.eventBus.on('sync.started', (e) => started.push(e));
    ctx.eventBus.on('sync.finished', (e) => finished.push(e));
    await conn.synchronize(job());
    await conn.disconnect();
    expect(started).toHaveLength(1);
    expect(finished).toHaveLength(1);
  });
});

// ── Health ────────────────────────────────────────────────────────────────────

describe('Health check (real DB)', () => {
  it('returns healthy status with real latency', async () => {
    const res = await connector.health();
    expect(res.ok).toBe(true);
    expect(res.data!.status).toBe('healthy');
    expect(res.data!.responseTimeMs).toBeGreaterThanOrEqual(0);
  });
});
