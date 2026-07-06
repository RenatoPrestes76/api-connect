/**
 * @seltriva/connectors/discovery
 * Discovery Engine — introspects any connected source and maps its structure
 */

import type { DiscoveryOptions, DiscoveredItem } from '../core/index';

// ─── Discovery Engine ─────────────────────────────────────────────────────────

/**
 * The primary interface for discovering what exists in a connected source.
 * Every connector must provide a DiscoveryEngine implementation.
 */
export interface DiscoveryEngine {
  /**
   * Perform a full discovery pass of the connected source
   */
  discover(options?: DiscoveryOptions): Promise<DiscoveryReport>;

  /**
   * Discover the children of a specific item (lazy tree traversal)
   */
  discoverChildren(parentId: string, options?: DiscoveryOptions): Promise<DiscoveredItem[]>;

  /**
   * Search within discovered items
   */
  search(query: DiscoveryQuery): Promise<DiscoverySearchResult>;

  /**
   * Return the last discovery report without re-running discovery
   */
  getCached(): DiscoveryReport | null;

  /**
   * Clear the discovery cache and force a fresh run on next call
   */
  invalidate(): void;
}

// ─── Discovery Report ─────────────────────────────────────────────────────────

/**
 * Complete result of a discovery pass
 */
export interface DiscoveryReport {
  readonly connectorId: string;
  readonly sourceType: string;
  readonly items: DiscoveredItem[];
  readonly tree: DiscoveryTree;
  readonly stats: DiscoveryStats;
  readonly warnings: string[];
  readonly discoveredAt: Date;
  readonly durationMs: number;
}

/**
 * Hierarchical tree representation of discovered items
 */
export interface DiscoveryTree {
  readonly root: DiscoveryTreeNode;
}

export interface DiscoveryTreeNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly path: string;
  readonly children: DiscoveryTreeNode[];
  readonly metadata?: Record<string, unknown>;
  readonly discoverable: boolean;
}

/**
 * Aggregate stats about a discovery run
 */
export interface DiscoveryStats {
  readonly totalItems: number;
  readonly byType: Record<string, number>;
  readonly maxDepth: number;
  readonly truncated: boolean;
  readonly truncatedAt?: string;
}

// ─── Discovery Query ─────────────────────────────────────────────────────────

export interface DiscoveryQuery {
  readonly term: string;
  readonly types?: string[];
  readonly parent?: string;
  readonly limit?: number;
  readonly fuzzy?: boolean;
}

export interface DiscoverySearchResult {
  readonly items: DiscoveredItem[];
  readonly total: number;
  readonly query: DiscoveryQuery;
  readonly durationMs: number;
}

// ─── Discovery Strategies ─────────────────────────────────────────────────────

/**
 * Strategy interface — each connector type implements its own discovery strategy
 */
export interface DiscoveryStrategy {
  discover(context: DiscoveryContext): Promise<DiscoveredItem[]>;
  getStrategyName(): string;
  getSupportedTypes(): string[];
}

export interface DiscoveryContext {
  readonly connectorId: string;
  readonly connection: unknown;
  readonly options: DiscoveryOptions;
  readonly logger: unknown;
}

// ─── Specialized Discovery Extensions ─────────────────────────────────────────

/**
 * Extended discovery for relational databases
 */
export interface RelationalDiscoveryEngine extends DiscoveryEngine {
  discoverDatabases(): Promise<DiscoveredItem[]>;
  discoverSchemas(database: string): Promise<DiscoveredItem[]>;
  discoverTables(schema: string, database?: string): Promise<DiscoveredItem[]>;
  discoverColumns(table: string, schema?: string): Promise<DiscoveredItem[]>;
  discoverIndexes(table: string, schema?: string): Promise<DiscoveredItem[]>;
  discoverProcedures(schema?: string): Promise<DiscoveredItem[]>;
  discoverViews(schema?: string): Promise<DiscoveredItem[]>;
  discoverTriggers(table?: string): Promise<DiscoveredItem[]>;
  discoverRelationships(table: string): Promise<DiscoveredItem[]>;
}

/**
 * Extended discovery for document stores / NoSQL
 */
export interface DocumentDiscoveryEngine extends DiscoveryEngine {
  discoverCollections(database?: string): Promise<DiscoveredItem[]>;
  discoverDocumentShape(collection: string, sampleSize?: number): Promise<DiscoveredItem[]>;
  discoverIndexes(collection: string): Promise<DiscoveredItem[]>;
}

/**
 * Extended discovery for REST / HTTP APIs
 */
export interface ApiDiscoveryEngine extends DiscoveryEngine {
  discoverEndpoints(): Promise<DiscoveredItem[]>;
  discoverOperations(path: string): Promise<DiscoveredItem[]>;
  discoverSchemas(): Promise<DiscoveredItem[]>;
  loadOpenApiSpec(): Promise<Record<string, unknown>>;
}

/**
 * Extended discovery for file sources
 */
export interface FileDiscoveryEngine extends DiscoveryEngine {
  discoverFiles(path?: string): Promise<DiscoveredItem[]>;
  discoverStructure(filePath: string): Promise<DiscoveredItem[]>;
}

/**
 * Extended discovery for cloud storage
 */
export interface CloudDiscoveryEngine extends DiscoveryEngine {
  discoverBuckets(): Promise<DiscoveredItem[]>;
  discoverObjects(bucket: string, prefix?: string): Promise<DiscoveredItem[]>;
}

/**
 * Extended discovery for message queues
 */
export interface QueueDiscoveryEngine extends DiscoveryEngine {
  discoverQueues(): Promise<DiscoveredItem[]>;
  discoverTopics(): Promise<DiscoveredItem[]>;
  discoverConsumerGroups(topic?: string): Promise<DiscoveredItem[]>;
  discoverMessageSchema(queue: string): Promise<DiscoveredItem[]>;
}
