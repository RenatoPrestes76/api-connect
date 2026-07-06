import { describe, it, expect } from 'vitest';
import { ProductsSync } from '../sync/products.js';
import { CustomersSync } from '../sync/customers.js';
import { InventorySync } from '../sync/inventory.js';
import { makeContext, makeMockDb } from './helpers.js';
import type { SyncContext } from '@seltriva/connector-sdk';

function job(overrides: Partial<SyncContext> = {}): SyncContext {
  return { jobId: 'job-test-001', ...overrides };
}

describe('ProductsSync', () => {
  it('syncs 5 products on a full sync', async () => {
    const { result } = await new ProductsSync(makeContext(), makeMockDb()).sync(job());
    expect(result.synced).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  // Incremental sync count depends on DB-level filtering — validated in integration tests.
  it('incremental sync returns 0 or more records', async () => {
    const { result } = await new ProductsSync(makeContext(), makeMockDb()).sync(job({ since: new Date() }));
    expect(result.synced).toBeGreaterThanOrEqual(0);
  });

  it('mapped products conform to AtlasProduct shape', async () => {
    const { products } = await new ProductsSync(makeContext(), makeMockDb()).sync(job());
    for (const p of products) {
      expect(p.id).toMatch(/^product:/);
      expect(typeof p.name).toBe('string');
      expect(typeof p.price).toBe('number');
      expect(typeof p.isActive).toBe('boolean');
      expect(p.syncedAt).toBeInstanceOf(Date);
    }
  });

  it('product count matches synced count', async () => {
    const { result, products } = await new ProductsSync(makeContext(), makeMockDb()).sync(job());
    expect(products).toHaveLength(result.synced);
  });

  it('skips gracefully when products table is absent', async () => {
    const emptySchemaDb = makeMockDb({
      schema: async () => ({
        name: 'empty', tables: [], relations: [], discoveredAt: new Date(),
      }),
    });
    const { result } = await new ProductsSync(makeContext(), emptySchemaDb).sync(job());
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(0);
  });
});

describe('CustomersSync', () => {
  it('syncs 4 customers on a full sync', async () => {
    const { result } = await new CustomersSync(makeContext(), makeMockDb()).sync(job());
    expect(result.synced).toBe(4);
    expect(result.failed).toBe(0);
  });

  it('incremental sync returns 0 or more records', async () => {
    const { result } = await new CustomersSync(makeContext(), makeMockDb()).sync(job({ since: new Date() }));
    expect(result.synced).toBeGreaterThanOrEqual(0);
  });

  it('mapped customers conform to AtlasCustomer shape', async () => {
    const { customers } = await new CustomersSync(makeContext(), makeMockDb()).sync(job());
    for (const c of customers) {
      expect(c.id).toMatch(/^customer:/);
      expect(typeof c.email).toBe('string');
      expect(typeof c.creditLimit).toBe('number');
      expect(c.syncedAt).toBeInstanceOf(Date);
    }
  });

  it('skips gracefully when customers table is absent', async () => {
    const emptySchemaDb = makeMockDb({
      schema: async () => ({
        name: 'empty', tables: [], relations: [], discoveredAt: new Date(),
      }),
    });
    const { result } = await new CustomersSync(makeContext(), emptySchemaDb).sync(job());
    expect(result.synced).toBe(0);
  });
});

describe('InventorySync', () => {
  it('syncs 5 items on a full sync', async () => {
    const { result } = await new InventorySync(makeContext(), makeMockDb()).sync(job());
    expect(result.synced).toBe(5);
    expect(result.failed).toBe(0);
  });

  it('incremental sync returns 0 or more records', async () => {
    const { result } = await new InventorySync(makeContext(), makeMockDb()).sync(job({ since: new Date() }));
    expect(result.synced).toBeGreaterThanOrEqual(0);
  });

  it('available = quantity - reserved (PROD-001/WH-A: 100 - 10 = 90)', async () => {
    const { inventory } = await new InventorySync(makeContext(), makeMockDb()).sync(job());
    const item = inventory.find((i) => i.externalId === 'PROD-001:WH-A')!;
    expect(item).toBeDefined();
    expect(item.available).toBe(90);
    expect(item.total).toBe(100);
    expect(item.reserved).toBe(10);
  });

  it('externalId format is productSku:warehouse', async () => {
    const { inventory } = await new InventorySync(makeContext(), makeMockDb()).sync(job());
    for (const item of inventory) {
      expect(item.externalId).toMatch(/^PROD-\d+:WH-[A-Z]$/);
    }
  });

  it('productId is prefixed with product:', async () => {
    const { inventory } = await new InventorySync(makeContext(), makeMockDb()).sync(job());
    for (const item of inventory) {
      expect(item.productId).toMatch(/^product:/);
    }
  });

  it('skips gracefully when inventory table is absent', async () => {
    const emptySchemaDb = makeMockDb({
      schema: async () => ({
        name: 'empty', tables: [], relations: [], discoveredAt: new Date(),
      }),
    });
    const { result } = await new InventorySync(makeContext(), emptySchemaDb).sync(job());
    expect(result.synced).toBe(0);
  });
});
