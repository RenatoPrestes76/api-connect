import { describe, it, expect, vi } from 'vitest';
import { DiscoveryEngine } from '../discovery.js';
import { makeContext, makeMockDb } from './helpers.js';

function makeEngine(connectorId = 'test-erp') {
  return new DiscoveryEngine(connectorId, makeContext(connectorId), makeMockDb());
}

describe('DiscoveryEngine', () => {
  it('discovers 6 entity types from mock schema', async () => {
    const result = await makeEngine().discover();
    expect(result.ok).toBe(true);
    expect(result.data!.entities).toHaveLength(6);
  });

  it('total matches entities count', async () => {
    const result = await makeEngine().discover();
    expect(result.data!.total).toBe(result.data!.entities.length);
  });

  it('every entity has type entity-collection', async () => {
    const result = await makeEngine().discover();
    for (const entity of result.data!.entities) {
      expect(entity.type).toBe('entity-collection');
    }
  });

  it('includes products, inventory, customers, sales, suppliers, users', async () => {
    const result = await makeEngine().discover();
    const names = result.data!.entities.map((e) => e.name);
    for (const expected of ['products', 'inventory', 'customers', 'sales', 'suppliers', 'users']) {
      expect(names).toContain(expected);
    }
  });

  it('emits discovery.finished event with correct payload', async () => {
    const ctx = makeContext('test-erp');
    const handler = vi.fn();
    ctx.eventBus.on('discovery.finished', handler);

    await new DiscoveryEngine('test-erp', ctx, makeMockDb()).discover();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].connectorId).toBe('test-erp');
    expect(handler.mock.calls[0][0].entitiesFound).toBe(6);
    expect(handler.mock.calls[0][0].finishedAt).toBeInstanceOf(Date);
  });

  it('entity extra.table resolves to the Portuguese table name', async () => {
    const result = await makeEngine().discover();
    const prod = result.data!.entities.find((e) => e.name === 'products')!;
    expect(prod.extra?.['table']).toBe('produtos');
    const cust = result.data!.entities.find((e) => e.name === 'customers')!;
    expect(cust.extra?.['table']).toBe('clientes');
  });

  it('entity extra.columns is a positive integer', async () => {
    const result = await makeEngine().discover();
    for (const entity of result.data!.entities) {
      expect(entity.extra?.['columns']).toBeGreaterThan(0);
    }
  });

  it('entity ids are prefixed with the connectorId', async () => {
    const result = await new DiscoveryEngine(
      'my-connector',
      makeContext('my-connector'),
      makeMockDb()
    ).discover();
    for (const entity of result.data!.entities) {
      expect(entity.id.startsWith('my-connector/')).toBe(true);
    }
  });
});
