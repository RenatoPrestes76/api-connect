/**
 * AnalysisCache — avoids re-analyzing schemas that haven't changed.
 *
 * Cache key: deterministic hash of the database schema fingerprint.
 * Fingerprint: sorted JSON of schema→tables→columns.
 * TTL: configurable (default 30 min).
 */
import type { DatabaseIntelligenceReport, DatabaseInput } from '../types/index.js';

interface CacheEntry {
  readonly report:    DatabaseIntelligenceReport;
  readonly expiresAt: number;
  readonly fingerprint: string;
}

export class AnalysisCache {
  private readonly _store = new Map<string, CacheEntry>();

  constructor(private readonly _ttlMs: number = 30 * 60 * 1000) {}

  fingerprint(input: DatabaseInput): string {
    const schemas = [...input.schemas]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        n: s.name,
        t: [...s.tables]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => ({
            n: t.name,
            c: [...t.columns]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((col) => `${col.name}:${col.dataType}`),
            fk: t.foreignKeys.length,
          })),
      }));

    return simpleHash(JSON.stringify({ db: input.database, schemas }));
  }

  get(fingerprint: string): DatabaseIntelligenceReport | null {
    const entry = this._store.get(fingerprint);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(fingerprint);
      return null;
    }
    return entry.report;
  }

  set(fingerprint: string, report: DatabaseIntelligenceReport): void {
    this._store.set(fingerprint, {
      report,
      expiresAt:   Date.now() + this._ttlMs,
      fingerprint,
    });
  }

  invalidate(fingerprint: string): void {
    this._store.delete(fingerprint);
  }

  clear(): void {
    this._store.clear();
  }

  get size(): number { return this._store.size; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
