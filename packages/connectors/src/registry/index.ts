/**
 * @seltriva/connectors/registry
 * Connector Registry — dynamic, type-safe connector registration. No switch. No if.
 */

import type { Connector, ConnectorDescriptor, ConnectorType, ConnectorConfig } from '../core/index';

// ─── Registry Entry ───────────────────────────────────────────────────────

/**
 * A single entry in the connector registry
 */
export interface ConnectorRegistryEntry {
  readonly descriptor: ConnectorDescriptor;
  readonly factory: ConnectorFactory;
  readonly configSchema?: ConnectorConfigSchema;
  readonly registeredAt: Date;
  readonly tags: string[];
  readonly enabled: boolean;
}

/**
 * Factory function that creates a connector instance from config
 */
export type ConnectorFactory = (config: ConnectorConfig) => Promise<Connector> | Connector;

/**
 * JSON Schema-compatible config descriptor for a connector
 */
export interface ConnectorConfigSchema {
  readonly properties: Record<string, ConnectorConfigProperty>;
  readonly required: string[];
  readonly additionalProperties?: boolean;
}

export interface ConnectorConfigProperty {
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  readonly label: string;
  readonly description?: string;
  readonly default?: unknown;
  readonly enum?: unknown[];
  readonly secret?: boolean;
  readonly required?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly example?: unknown;
}

// ─── Connector Registry ───────────────────────────────────────────────────

/**
 * Central registry for all connector types.
 * Connectors are looked up by id — no switch, no if chains.
 */
export interface ConnectorRegistry {
  /**
   * Register a connector type with its factory and optional config schema
   */
  register(
    descriptor: ConnectorDescriptor,
    factory: ConnectorFactory,
    options?: ConnectorRegistrationOptions
  ): void;

  /**
   * Unregister a connector type by id
   */
  unregister(connectorId: string): boolean;

  /**
   * Enable a registered connector
   */
  enable(connectorId: string): void;

  /**
   * Disable a registered connector (keeps registration but prevents instantiation)
   */
  disable(connectorId: string): void;

  /**
   * Check if a connector type is registered
   */
  has(connectorId: string): boolean;

  /**
   * Check if a connector type is registered AND enabled
   */
  isEnabled(connectorId: string): boolean;

  /**
   * Retrieve a registry entry by connector id
   */
  get(connectorId: string): ConnectorRegistryEntry | null;

  /**
   * Get all registered connector entries
   */
  getAll(): ConnectorRegistryEntry[];

  /**
   * Get all entries matching a ConnectorType category
   */
  getByType(type: ConnectorType): ConnectorRegistryEntry[];

  /**
   * Get entries matching any of the provided tags
   */
  getByTags(tags: string[]): ConnectorRegistryEntry[];

  /**
   * Find entries whose descriptor matches the given search criteria
   */
  find(criteria: ConnectorSearchCriteria): ConnectorRegistryEntry[];

  /**
   * Count registered connectors
   */
  count(): number;

  /**
   * Count by type
   */
  countByType(): Record<ConnectorType, number>;

  /**
   * Return all registered connector ids
   */
  ids(): string[];

  /**
   * Clear all registrations (use with caution — typically test-only)
   */
  clear(): void;

  /**
   * Subscribe to registry change events
   */
  onChange(handler: (event: RegistryChangeEvent) => void): string;

  /**
   * Unsubscribe from registry changes
   */
  offChange(subscriptionId: string): void;
}

// ─── Registration Options ─────────────────────────────────────────────────

export interface ConnectorRegistrationOptions {
  readonly configSchema?: ConnectorConfigSchema;
  readonly tags?: string[];
  readonly enabled?: boolean;
  readonly replace?: boolean;
}

// ─── Search ───────────────────────────────────────────────────────────────

export interface ConnectorSearchCriteria {
  readonly type?: ConnectorType;
  readonly subtype?: string;
  readonly vendor?: string;
  readonly tags?: string[];
  readonly enabledOnly?: boolean;
  readonly namePattern?: string;
}

// ─── Registry Events ──────────────────────────────────────────────────────

export interface RegistryChangeEvent {
  readonly action: 'registered' | 'unregistered' | 'enabled' | 'disabled' | 'updated';
  readonly connectorId: string;
  readonly descriptor: ConnectorDescriptor;
  readonly timestamp: Date;
}

// ─── Instance Registry ────────────────────────────────────────────────────

/**
 * Tracks live connector instances (distinct from type registry)
 */
export interface ConnectorInstanceRegistry {
  /**
   * Store a live connector instance
   */
  set(instanceId: string, connector: Connector): void;

  /**
   * Retrieve a live connector instance
   */
  get(instanceId: string): Connector | null;

  /**
   * Remove a live connector instance
   */
  remove(instanceId: string): boolean;

  /**
   * Check if an instance is registered
   */
  has(instanceId: string): boolean;

  /**
   * Get all live instances
   */
  getAll(): Record<string, Connector>;

  /**
   * Get all instances of a specific connector type
   */
  getByType(type: ConnectorType): Connector[];

  /**
   * Get instance count
   */
  count(): number;

  /**
   * Disconnect and remove all instances (shutdown)
   */
  disposeAll(): Promise<void>;
}

// ─── Registry Manager ─────────────────────────────────────────────────────

/**
 * Combines type registry and instance registry into a single manager
 */
export interface ConnectorRegistryManager {
  readonly typeRegistry: ConnectorRegistry;
  readonly instanceRegistry: ConnectorInstanceRegistry;

  /**
   * Register a connector type (delegates to typeRegistry)
   */
  registerType(
    descriptor: ConnectorDescriptor,
    factory: ConnectorFactory,
    options?: ConnectorRegistrationOptions
  ): void;

  /**
   * Create and register a live instance
   */
  createInstance(typeId: string, instanceId: string, config: ConnectorConfig): Promise<Connector>;

  /**
   * Dispose a live instance and remove it from the instance registry
   */
  disposeInstance(instanceId: string): Promise<void>;

  /**
   * Dump the full registry state (for diagnostics)
   */
  dump(): ConnectorRegistryDump;
}

export interface ConnectorRegistryDump {
  readonly types: ConnectorRegistryEntry[];
  readonly instances: Record<string, ConnectorDescriptor>;
  readonly generatedAt: Date;
}
