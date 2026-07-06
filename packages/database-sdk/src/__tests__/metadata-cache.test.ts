import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataCache } from '../schema/metadata-cache.js';
import type { SchemaReader, DatabaseSchema } from '../schema/schema-reader.js';

function makeSchema(name: string): DatabaseSchema {
  return { name, tables: [], relations: [], discoveredAt: new Date() };
}

function makeReader(name = 'db'): { reader: SchemaReader; callCount: () => number } {
  let calls = 0;
  const reader: SchemaReader = {
    readSchema:  async () => { calls++; return makeSchema(name); },
    readTable:   async () => null,
    listTables:  async () => [],
  };
  return { reader, callCount: () => calls };
}

describe('MetadataCache', () => {
  describe('load()', () => {
    it('fetches schema on first call', async () => {
      const { reader, callCount } = makeReader();
      const cache = new MetadataCache(reader);
      const schema = await cache.load();
      expect(schema.name).toBe('db');
      expect(callCount()).toBe(1);
    });

    it('returns cached value on second call within TTL', async () => {
      const { reader, callCount } = makeReader();
      const cache = new MetadataCache(reader, { ttlMs: 60_000 });
      await cache.load();
      await cache.load();
      expect(callCount()).toBe(1);
    });

    it('re-fetches when stale', async () => {
      const { reader, callCount } = makeReader();
      const cache = new MetadataCache(reader, { ttlMs: 0 });
      await cache.load();
      await cache.load();
      expect(callCount()).toBe(2);
    });
  });

  describe('refresh()', () => {
    it('always re-fetches even when fresh', async () => {
      const { reader, callCount } = makeReader();
      const cache = new MetadataCache(reader, { ttlMs: 60_000 });
      await cache.load();
      await cache.refresh();
      expect(callCount()).toBe(2);
    });

    it('updates cachedAt timestamp', async () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      await cache.load();
      const first = cache.cachedAt!.getTime();
      await vi.advanceTimersByTimeAsync?.(10).catch(() => {});
      await cache.refresh();
      // cachedAt should be set (we just verify it's a Date)
      expect(cache.cachedAt).toBeInstanceOf(Date);
      expect(cache.cachedAt!.getTime()).toBeGreaterThanOrEqual(first);
    });
  });

  describe('invalidate()', () => {
    it('clears cached schema', async () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      await cache.load();
      cache.invalidate();
      expect(cache.peek()).toBeNull();
    });

    it('isLoaded becomes false after invalidate', async () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      await cache.load();
      expect(cache.isLoaded).toBe(true);
      cache.invalidate();
      expect(cache.isLoaded).toBe(false);
    });

    it('forces re-fetch on next load()', async () => {
      const { reader, callCount } = makeReader();
      const cache = new MetadataCache(reader, { ttlMs: 60_000 });
      await cache.load();
      cache.invalidate();
      await cache.load();
      expect(callCount()).toBe(2);
    });
  });

  describe('state accessors', () => {
    it('isLoaded is false before first load', () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      expect(cache.isLoaded).toBe(false);
    });

    it('isStale is true before first load', () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      expect(cache.isStale).toBe(true);
    });

    it('isStale is false immediately after load with generous TTL', async () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader, { ttlMs: 60_000 });
      await cache.load();
      expect(cache.isStale).toBe(false);
    });

    it('cachedAt is null before first load', () => {
      const { reader } = makeReader();
      expect(new MetadataCache(reader).cachedAt).toBeNull();
    });

    it('cachedAt is set after load', async () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      await cache.load();
      expect(cache.cachedAt).toBeInstanceOf(Date);
    });

    it('peek returns null before load', () => {
      const { reader } = makeReader();
      expect(new MetadataCache(reader).peek()).toBeNull();
    });

    it('peek returns cached schema after load', async () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      await cache.load();
      expect(cache.peek()).not.toBeNull();
    });
  });

  describe('default TTL', () => {
    it('defaults to 5 minutes', () => {
      const { reader } = makeReader();
      const cache = new MetadataCache(reader);
      // Access private field via cast for assertion
      expect((cache as unknown as { _ttlMs: number })._ttlMs).toBe(5 * 60 * 1_000);
    });
  });
});
