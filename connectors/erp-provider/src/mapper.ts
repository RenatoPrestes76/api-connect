// ERP-native types (as returned by the ERP database)

export interface ErpProduct {
  readonly sku:        string;
  readonly name:       string;
  readonly price:      number;
  readonly category:   string;
  readonly active:     boolean;
  readonly updatedAt?: string;
}

export interface ErpCustomer {
  readonly code:        string;
  readonly name:        string;
  readonly email:       string;
  readonly taxId:       string;
  readonly creditLimit: number;
  readonly active:      boolean;
  readonly updatedAt?:  string;
}

export interface ErpInventoryItem {
  readonly productSku:  string;
  readonly warehouse:   string;
  readonly quantity:    number;
  readonly reserved:    number;
  readonly updatedAt?:  string;
}

// Atlas canonical types

export interface AtlasProduct {
  readonly id:         string;
  readonly name:       string;
  readonly price:      number;
  readonly category:   string;
  readonly isActive:   boolean;
  readonly externalId: string;
  readonly syncedAt:   Date;
}

export interface AtlasCustomer {
  readonly id:          string;
  readonly name:        string;
  readonly email:       string;
  readonly taxId:       string;
  readonly creditLimit: number;
  readonly isActive:    boolean;
  readonly externalId:  string;
  readonly syncedAt:    Date;
}

export interface AtlasInventory {
  readonly productId:  string;
  readonly warehouse:  string;
  readonly available:  number;
  readonly reserved:   number;
  readonly total:      number;
  readonly externalId: string;
  readonly syncedAt:   Date;
}

export function mapProduct(erp: ErpProduct): AtlasProduct {
  return {
    id:         `product:${erp.sku}`,
    name:       erp.name,
    price:      erp.price,
    category:   erp.category,
    isActive:   erp.active,
    externalId: erp.sku,
    syncedAt:   new Date(),
  };
}

export function mapCustomer(erp: ErpCustomer): AtlasCustomer {
  return {
    id:          `customer:${erp.code}`,
    name:        erp.name,
    email:       erp.email,
    taxId:       erp.taxId,
    creditLimit: erp.creditLimit,
    isActive:    erp.active,
    externalId:  erp.code,
    syncedAt:    new Date(),
  };
}

export function mapInventory(erp: ErpInventoryItem): AtlasInventory {
  return {
    productId:  `product:${erp.productSku}`,
    warehouse:  erp.warehouse,
    available:  erp.quantity - erp.reserved,
    reserved:   erp.reserved,
    total:      erp.quantity,
    externalId: `${erp.productSku}:${erp.warehouse}`,
    syncedAt:   new Date(),
  };
}
