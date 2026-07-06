/**
 * @seltriva/agent — cache
 * Local persistent cache for schema metadata and sync state.
 *
 * The agent cache serves two purposes:
 *   1. Schema cache — stores discovered schema metadata locally so the
 *      agent can operate without querying the database on every sync.
 *   2. Offline store — a durable write-ahead store for payloads that
 *      need to be transmitted to the cloud when connectivity resumes.
 *
 * Storage backend: SQLite via better-sqlite3 (embedded, zero infrastructure).
 */

import type { AgentResult, ConnectorId, CacheKey } from '../configuration/index';
import type { SchemaSnapshot } from '../sync/index';

// ─── Agent Cache ──────────────────────────────────────────────────────────

export interface AgentCache {
  readonly schema: SchemaCache;
  readonly kv: KVCache;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;

  /**
   * Clear all cache data (all namespaces)
   */
  clearAll(): AgentResult<void>;

  /**
   * Initialize the cache (open SQLite, run migrations)
   */
  init(dataDir: string): AgentResult<void>;

  /**
   * Close the cache (flush buffers, close SQLite)
   */
  close(): AgentResult<void>;

  /**
   * Vacuum the SQLite database (reclaim space)
   */
  compact(): AgentResult<void>;
}

// ─── Schema Cache ─────────────────────────────────────────────────────────

export interface SchemaCache {
  /**
   * Store a schema snapshot for a connector
   */
  put(connectorId: ConnectorId, snapshot: SchemaSnapshot): AgentResult<void>;

  /**
   * Get the most recently cached snapshot for a connector
   */
  get(connectorId: ConnectorId): SchemaSnapshot | null;

  /**
   * Delete the cached snapshot for a connector
   */
  invalidate(connectorId: ConnectorId): AgentResult<void>;

  /**
   * Check if a connector has a cached snapshot
   */
  has(connectorId: ConnectorId): boolean;

  /**
   * Get the age of the cache entry in milliseconds
   */
  getAge(connectorId: ConnectorId): number | null;

  /**
   * List all connectors with cached snapshots
   */
  listConnectors(): ConnectorId[];
}

// ─── Key-Value Cache ──────────────────────────────────────────────────────

export interface KVCache {
  /**
   * Set a value with optional TTL
   */
  set<T>(key: CacheKey, value: T, ttlSeconds?: number): AgentResult<void>;

  /**
   * Get a value (returns null if not found or expired)
   */
  get<T>(key: CacheKey): T | null;

  /**
   * Delete a value
   */
  delete(key: CacheKey): AgentResult<void>;

  /**
   * Check if a key exists and has not expired
   */
  has(key: CacheKey): boolean;

  /**
   * Get keys matching a prefix
   */
  keys(prefix?: string): CacheKey[];

  /**
   * Clear all keys with a prefix
   */
  clearPrefix(prefix: string): AgentResult<number>;
}

// ─── Cache Stats ──────────────────────────────────────────────────────────

export interface CacheStats {
  readonly dbSizeBytes: number;
  readonly schemaEntries: number;
  readonly kvEntries: number;
  readonly hitCount: number;
  readonly missCount: number;
  readonly hitRatePercent: number;
  readonly oldestEntryAge?: number;
  readonly evictedCount: number;
}

// ─── Cache Namespace Keys ─────────────────────────────────────────────────

export const CACHE_PREFIXES = {
  SCHEMA:      'schema:',
  SYNC_STATE:  'sync:',
  HEALTH:      'health:',
  TOKEN:       'token:',
  CONFIG:      'config:',
} as const;
