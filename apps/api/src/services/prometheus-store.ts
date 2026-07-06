/**
 * PrometheusStore — in-memory analysis result cache.
 *
 * Each call to POST /discovery/analyze-schema produces a UUID analysisId.
 * Subsequent GET /discovery/entities|suggestions|graph use that ID to retrieve
 * the cached report without re-running the scanner.
 *
 * Entries are evicted after ttlMs (default 30 min) to prevent unbounded growth.
 */
import type { DatabaseIntelligenceReport } from '@seltriva/database-intelligence';

const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface Entry {
  readonly report:    DatabaseIntelligenceReport;
  readonly expiresAt: number;
}

export class PrometheusStore {
  private readonly _store  = new Map<string, Entry>();
  private readonly _ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this._ttlMs = ttlMs;
  }

  set(id: string, report: DatabaseIntelligenceReport): void {
    this._store.set(id, { report, expiresAt: Date.now() + this._ttlMs });
    this._evict();
  }

  get(id: string): DatabaseIntelligenceReport | undefined {
    const entry = this._store.get(id);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(id);
      return undefined;
    }
    return entry.report;
  }

  get size(): number { return this._store.size; }

  entries(): Array<[string, DatabaseIntelligenceReport]> {
    this._evict();
    return [...this._store.entries()].map(([id, e]) => [id, e.report]);
  }

  private _evict(): void {
    const now = Date.now();
    for (const [id, entry] of this._store) {
      if (now > entry.expiresAt) this._store.delete(id);
    }
  }
}

/** Module-level singleton shared across all route handlers. */
export const prometheusStore = new PrometheusStore();
