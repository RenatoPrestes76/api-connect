import { describe, it, expect } from 'vitest';
import { mapProduct, mapCustomer, mapInventory } from '../mapper.js';
import type { ErpProduct, ErpCustomer, ErpInventoryItem } from '../mapper.js';

const SAMPLE_PRODUCT: ErpProduct = {
  sku: 'SKU-001',
  name: 'Test Widget',
  price: 9.99,
  category: 'Test',
  active: true,
};

const SAMPLE_CUSTOMER: ErpCustomer = {
  code: 'C-001',
  name: 'Acme Inc',
  email: 'acme@test.com',
  taxId: '00.000.000/0001-00',
  creditLimit: 10000,
  active: true,
};

const SAMPLE_INVENTORY: ErpInventoryItem = {
  productSku: 'SKU-001',
  warehouse: 'WH-A',
  quantity: 100,
  reserved: 25,
};

describe('mapProduct', () => {
  it('id is prefixed with product:', () => {
    expect(mapProduct(SAMPLE_PRODUCT).id).toBe('product:SKU-001');
  });

  it('copies name, price, and category', () => {
    const mapped = mapProduct(SAMPLE_PRODUCT);
    expect(mapped.name).toBe('Test Widget');
    expect(mapped.price).toBe(9.99);
    expect(mapped.category).toBe('Test');
  });

  it('maps active=true to isActive=true', () => {
    expect(mapProduct({ ...SAMPLE_PRODUCT, active: true }).isActive).toBe(true);
  });

  it('maps active=false to isActive=false', () => {
    expect(mapProduct({ ...SAMPLE_PRODUCT, active: false }).isActive).toBe(false);
  });

  it('externalId equals the original sku', () => {
    expect(mapProduct(SAMPLE_PRODUCT).externalId).toBe('SKU-001');
  });

  it('syncedAt is a Date instance', () => {
    expect(mapProduct(SAMPLE_PRODUCT).syncedAt).toBeInstanceOf(Date);
  });
});

describe('mapCustomer', () => {
  it('id is prefixed with customer:', () => {
    expect(mapCustomer(SAMPLE_CUSTOMER).id).toBe('customer:C-001');
  });

  it('copies name, email, taxId, and creditLimit', () => {
    const mapped = mapCustomer(SAMPLE_CUSTOMER);
    expect(mapped.name).toBe('Acme Inc');
    expect(mapped.email).toBe('acme@test.com');
    expect(mapped.taxId).toBe('00.000.000/0001-00');
    expect(mapped.creditLimit).toBe(10000);
  });

  it('maps active to isActive', () => {
    expect(mapCustomer({ ...SAMPLE_CUSTOMER, active: false }).isActive).toBe(false);
    expect(mapCustomer({ ...SAMPLE_CUSTOMER, active: true }).isActive).toBe(true);
  });

  it('externalId equals the original code', () => {
    expect(mapCustomer(SAMPLE_CUSTOMER).externalId).toBe('C-001');
  });

  it('syncedAt is a Date instance', () => {
    expect(mapCustomer(SAMPLE_CUSTOMER).syncedAt).toBeInstanceOf(Date);
  });
});

describe('mapInventory', () => {
  it('productId is prefixed with product:', () => {
    expect(mapInventory(SAMPLE_INVENTORY).productId).toBe('product:SKU-001');
  });

  it('available equals quantity minus reserved', () => {
    expect(mapInventory(SAMPLE_INVENTORY).available).toBe(75); // 100 - 25
  });

  it('total equals quantity', () => {
    expect(mapInventory(SAMPLE_INVENTORY).total).toBe(100);
  });

  it('reserved is preserved', () => {
    expect(mapInventory(SAMPLE_INVENTORY).reserved).toBe(25);
  });

  it('externalId has format productSku:warehouse', () => {
    expect(mapInventory(SAMPLE_INVENTORY).externalId).toBe('SKU-001:WH-A');
  });

  it('copies warehouse', () => {
    expect(mapInventory(SAMPLE_INVENTORY).warehouse).toBe('WH-A');
  });

  it('syncedAt is a Date instance', () => {
    expect(mapInventory(SAMPLE_INVENTORY).syncedAt).toBeInstanceOf(Date);
  });
});
