import { describe, it, expect } from 'vitest';
import {
  CONNECTOR_CATALOG,
  getConnector,
  listByCategory,
  searchConnectors,
  CONNECTOR_CATEGORIES,
} from '../catalog.js';

describe('CONNECTOR_CATALOG', () => {
  it('has 30 connectors', () => {
    expect(CONNECTOR_CATALOG).toHaveLength(30);
  });

  it('all IDs are unique', () => {
    const ids = CONNECTOR_CATALOG.map((c) => c.manifest.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all 10 categories', () => {
    const cats = new Set(CONNECTOR_CATALOG.map((c) => c.manifest.category));
    expect(cats.size).toBe(10);
    for (const cat of CONNECTOR_CATEGORIES) {
      expect(cats.has(cat), `category "${cat}" should be present`).toBe(true);
    }
  });

  it('every connector has required fields', () => {
    for (const c of CONNECTOR_CATALOG) {
      expect(c.manifest.id).toBeTruthy();
      expect(c.manifest.name).toBeTruthy();
      expect(c.manifest.version).toBeTruthy();
      expect(c.manifest.description).toBeTruthy();
      expect(c.manifest.author).toBeTruthy();
      expect(c.manifest.license).toBeTruthy();
      expect(c.manifest.category).toBeTruthy();
      expect(Array.isArray(c.manifest.keywords)).toBe(true);
      expect(Array.isArray(c.manifest.permissions)).toBe(true);
      expect(c.manifest.resourceLimits.cpuCores).toBeGreaterThan(0);
      expect(c.manifest.resourceLimits.memoryMb).toBeGreaterThan(0);
    }
  });

  it('every connector has at least one version', () => {
    for (const c of CONNECTOR_CATALOG) {
      expect(c.versions.length).toBeGreaterThan(0);
    }
  });

  it('every connector has at least one review', () => {
    for (const c of CONNECTOR_CATALOG) {
      expect(c.reviews.length).toBeGreaterThan(0);
    }
  });

  it('ratings are in range 1-5', () => {
    for (const c of CONNECTOR_CATALOG) {
      expect(c.rating).toBeGreaterThanOrEqual(1);
      expect(c.rating).toBeLessThanOrEqual(5);
      for (const r of c.reviews) {
        expect(r.rating).toBeGreaterThanOrEqual(1);
        expect(r.rating).toBeLessThanOrEqual(5);
      }
    }
  });

  it('all connectors have checksum and signature', () => {
    for (const c of CONNECTOR_CATALOG) {
      expect(c.checksum).toBeTruthy();
      expect(c.signature).toBeTruthy();
    }
  });

  it('has featured connectors', () => {
    const featured = CONNECTOR_CATALOG.filter((c) => c.featured);
    expect(featured.length).toBeGreaterThan(0);
  });

  it('all connectors are verified', () => {
    expect(CONNECTOR_CATALOG.every((c) => c.verified)).toBe(true);
  });
});

describe('getConnector', () => {
  it('returns connector by id', () => {
    const c = getConnector('seltriva-erp');
    expect(c).toBeDefined();
    expect(c?.manifest.id).toBe('seltriva-erp');
  });

  it('returns undefined for unknown id', () => {
    expect(getConnector('non-existent')).toBeUndefined();
  });

  it('finds connectors from every category', () => {
    const ids = [
      'seltriva-erp',
      'salesforce',
      'shopify',
      'mercado-livre',
      'infor-wms',
      'postgresql',
      'generic-rest',
      'apollo-graphql',
      'rabbitmq',
      'aws-s3',
    ];
    for (const id of ids) {
      expect(getConnector(id), `${id} should exist`).toBeDefined();
    }
  });
});

describe('listByCategory', () => {
  it('filters by ERP category', () => {
    const result = listByCategory('ERP');
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.every((c) => c.manifest.category === 'ERP')).toBe(true);
  });

  it('filters by Mensageria category', () => {
    const result = listByCategory('Mensageria');
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.every((c) => c.manifest.category === 'Mensageria')).toBe(true);
  });

  it('returns empty array for unknown category', () => {
    expect(listByCategory('Unknown')).toHaveLength(0);
  });
});

describe('searchConnectors', () => {
  it('finds connector by name substring', () => {
    const result = searchConnectors('shopify');
    expect(result.some((c) => c.manifest.id === 'shopify')).toBe(true);
  });

  it('finds connector by keyword', () => {
    const result = searchConnectors('kafka');
    expect(result.some((c) => c.manifest.id === 'apache-kafka')).toBe(true);
  });

  it('finds connectors by category name', () => {
    const result = searchConnectors('erp');
    expect(result.length).toBeGreaterThan(0);
  });

  it('respects limit', () => {
    const result = searchConnectors('a', 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array for no matches', () => {
    expect(searchConnectors('zzznomatch123')).toHaveLength(0);
  });
});
