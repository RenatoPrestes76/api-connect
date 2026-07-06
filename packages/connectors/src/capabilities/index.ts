/**
 * @seltriva/connectors/capabilities
 * Capability System — runtime feature detection for connectors
 */

// ─── Capability Constants ────────────────────────────────────────────────────

/**
 * All first-class capabilities in the UDCF.
 * Use these constants instead of raw strings.
 */
export const CAPABILITIES = {
  // Data access
  READ: 'read',
  WRITE: 'write',

  // Schema
  SCHEMA_DISCOVERY: 'schema-discovery',

  // Transactional
  TRANSACTIONS: 'transactions',
  BATCH_OPERATIONS: 'batch-operations',
  ATOMIC_WRITES: 'atomic-writes',

  // Streaming / realtime
  STREAMING: 'streaming',
  REALTIME: 'realtime',
  CHANGE_DATA_CAPTURE: 'change-data-capture',

  // Data movement
  IMPORT: 'import',
  EXPORT: 'export',
  BULK_IMPORT: 'bulk-import',
  BULK_EXPORT: 'bulk-export',

  // Query
  PAGINATION: 'pagination',
  FILTERING: 'filtering',
  SORTING: 'sorting',
  AGGREGATION: 'aggregation',
  FULL_TEXT_SEARCH: 'full-text-search',

  // Security
  AUTHENTICATION: 'authentication',
  FIELD_ENCRYPTION: 'field-encryption',
  ROW_LEVEL_SECURITY: 'row-level-security',

  // Connectivity
  CONNECTION_POOLING: 'connection-pooling',
  RECONNECTION: 'reconnection',
  SSL_TLS: 'ssl-tls',

  // Protocol-specific
  STORED_PROCEDURES: 'stored-procedures',
  VIEWS: 'views',
  TRIGGERS: 'triggers',
  INDEXES: 'indexes',
  FOREIGN_KEYS: 'foreign-keys',

  // API-specific
  WEBHOOKS: 'webhooks',
  RATE_LIMITING: 'rate-limiting',
  IDEMPOTENCY: 'idempotency',

  // File-specific
  COMPRESSION: 'compression',
  ENCODING_DETECTION: 'encoding-detection',
  STREAMING_PARSE: 'streaming-parse',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// ─── Capability Descriptor ───────────────────────────────────────────────────

/**
 * Rich description of a single capability including constraints and metadata
 */
export interface CapabilityDescriptor {
  readonly id: Capability | string;
  readonly label: string;
  readonly description: string;
  readonly category: CapabilityCategory;
  readonly experimental?: boolean;
  readonly deprecated?: boolean;
  readonly requires?: string[];
  readonly conflicts?: string[];
  readonly metadata?: Record<string, unknown>;
}

export type CapabilityCategory =
  | 'data-access'
  | 'schema'
  | 'transactional'
  | 'streaming'
  | 'data-movement'
  | 'query'
  | 'security'
  | 'connectivity'
  | 'protocol'
  | 'custom';

// ─── Capability Set ──────────────────────────────────────────────────────────

/**
 * Immutable set of capabilities reported by a connector.
 * The primary API for runtime feature detection.
 */
export interface CapabilitySet {
  /** Check for a single capability */
  has(capability: string): boolean;

  /** Check that ALL listed capabilities are present */
  hasAll(capabilities: string[]): boolean;

  /** Check that ANY of the listed capabilities is present */
  hasAny(capabilities: string[]): boolean;

  /** Return all capability ids in this set */
  all(): readonly string[];

  /** Return capabilities matching a category */
  byCategory(category: CapabilityCategory): readonly string[];

  /** Return rich descriptors for all capabilities */
  describe(): readonly CapabilityDescriptor[];

  /** Count of capabilities */
  readonly size: number;
}

// ─── Capability Registry ─────────────────────────────────────────────────────

/**
 * Stores the canonical definition of every capability in the platform.
 * Connectors register custom capabilities here.
 */
export interface CapabilityRegistry {
  register(descriptor: CapabilityDescriptor): void;
  unregister(id: string): boolean;
  get(id: string): CapabilityDescriptor | null;
  getAll(): readonly CapabilityDescriptor[];
  getByCategory(category: CapabilityCategory): readonly CapabilityDescriptor[];
  isKnown(id: string): boolean;
}

// ─── Capability Builder ──────────────────────────────────────────────────────

/**
 * Fluent builder for constructing a CapabilitySet
 */
export interface CapabilitySetBuilder {
  add(capability: string | Capability): CapabilitySetBuilder;
  addAll(capabilities: (string | Capability)[]): CapabilitySetBuilder;
  remove(capability: string): CapabilitySetBuilder;
  build(): CapabilitySet;
}

// ─── Capability Negotiation ──────────────────────────────────────────────────

/**
 * Compares the caller's required capabilities against what a connector supports
 */
export interface CapabilityNegotiator {
  /**
   * Returns the capabilities the caller requires that the connector does NOT support
   */
  missing(required: string[], supported: CapabilitySet): string[];

  /**
   * Returns true only if all required capabilities are present
   */
  isSatisfied(required: string[], supported: CapabilitySet): boolean;

  /**
   * Returns a human-readable report of the negotiation outcome
   */
  report(required: string[], supported: CapabilitySet): CapabilityNegotiationReport;
}

export interface CapabilityNegotiationReport {
  readonly satisfied: boolean;
  readonly present: string[];
  readonly missing: string[];
  readonly optional: string[];
}
