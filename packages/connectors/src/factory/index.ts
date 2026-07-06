/**
 * @seltriva/connectors/factory
 * Connector Factory — creates and configures connector instances
 */

import type { Connector, ConnectorConfig, ConnectorType, ConnectorResult } from '../core/index';

// ─── Connector Factory ────────────────────────────────────────────────────

/**
 * The primary factory for creating connector instances.
 * Delegates to the registry — callers never import concrete connectors.
 */
export interface ConnectorFactory {
  /**
   * Create a connector instance by type id
   */
  create(typeId: string, config: ConnectorConfig): Promise<ConnectorResult<Connector>>;

  /**
   * Create and immediately connect a connector
   */
  createAndConnect(typeId: string, config: ConnectorConfig): Promise<ConnectorResult<Connector>>;

  /**
   * Create a connector from a serialized config (e.g., from the database)
   */
  createFromSerialized(serialized: SerializedConnectorConfig): Promise<ConnectorResult<Connector>>;

  /**
   * Check if a connector type can be created with the given config
   */
  canCreate(typeId: string, config: ConnectorConfig): Promise<boolean>;

  /**
   * Return the supported connector type ids
   */
  getSupportedTypes(): string[];
}

// ─── Connector Builder ────────────────────────────────────────────────────

/**
 * Fluent builder for assembling complex connector configurations step-by-step
 */
export interface ConnectorBuilder {
  forType(typeId: string): ConnectorBuilder;
  withName(name: string): ConnectorBuilder;
  withHost(host: string, port?: number): ConnectorBuilder;
  withCredentials(credentials: ConnectorBuilderCredentials): ConnectorBuilder;
  withDatabase(database: string): ConnectorBuilder;
  withPool(poolConfig: PoolConfig): ConnectorBuilder;
  withTimeout(timeoutMs: number): ConnectorBuilder;
  withRetry(retryConfig: RetryConfig): ConnectorBuilder;
  withSsl(sslConfig: SslConfig): ConnectorBuilder;
  withOption(key: string, value: unknown): ConnectorBuilder;
  withOptions(options: Record<string, unknown>): ConnectorBuilder;
  validate(): ConnectorBuilderValidationResult;
  build(): ConnectorConfig;
  buildAndCreate(): Promise<ConnectorResult<Connector>>;
}

export interface ConnectorBuilderCredentials {
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
  readonly apiKey?: string;
  readonly certificate?: string;
  readonly privateKey?: string;
}

export interface PoolConfig {
  readonly min: number;
  readonly max: number;
  readonly idleTimeoutMs?: number;
  readonly acquireTimeoutMs?: number;
  readonly createRetryIntervalMs?: number;
}

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly backoffMultiplier?: number;
  readonly maxDelayMs?: number;
  readonly retryOnCodes?: string[];
}

export interface SslConfig {
  readonly enabled: boolean;
  readonly rejectUnauthorized?: boolean;
  readonly ca?: string;
  readonly cert?: string;
  readonly key?: string;
  readonly servername?: string;
}

export interface ConnectorBuilderValidationResult {
  readonly isValid: boolean;
  readonly errors: Array<{ field: string; message: string }>;
  readonly warnings: Array<{ field: string; message: string }>;
}

// ─── Serialized Config ────────────────────────────────────────────────────

/**
 * Portable, serializable connector config (stored in database or config file)
 */
export interface SerializedConnectorConfig {
  readonly typeId: string;
  readonly instanceId: string;
  readonly name: string;
  readonly version: string;
  readonly config: Record<string, unknown>;
  readonly encryptedFields?: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ─── Abstract Factories (by connector category) ───────────────────────────

/**
 * Factory scoped to a specific connector category
 */
export interface DatabaseConnectorFactory extends ConnectorFactory {
  createRelational(subtype: RelationalDatabaseType, config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createDocument(subtype: DocumentDatabaseType, config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
}

export type RelationalDatabaseType =
  | 'postgresql'
  | 'sqlserver'
  | 'oracle'
  | 'firebird'
  | 'mysql'
  | 'mariadb'
  | 'sqlite';

export type DocumentDatabaseType = 'mongodb';

export interface ApiConnectorFactory extends ConnectorFactory {
  createRest(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createSoap(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createGraphQL(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createGrpc(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createWebhook(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
}

export interface FileConnectorFactory extends ConnectorFactory {
  createCsv(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createExcel(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createXml(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createJson(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createTxt(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createOds(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
}

export interface CloudConnectorFactory extends ConnectorFactory {
  createS3(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createAzureBlob(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createGcs(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createSupabaseStorage(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
}

export interface QueueConnectorFactory extends ConnectorFactory {
  createRabbitMQ(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createKafka(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
  createRedisStreams(config: ConnectorConfig): Promise<ConnectorResult<Connector>>;
}

// ─── Factory Registry ─────────────────────────────────────────────────────

/**
 * Maintains a map of type-specific factories, eliminating switch/if.
 * The framework asks the registry for the right factory and delegates creation.
 */
export interface ConnectorFactoryRegistry {
  registerFactory(type: ConnectorType, factory: ConnectorFactory): void;
  getFactory(type: ConnectorType): ConnectorFactory | null;
  getFactory(typeId: string): ConnectorFactory | null;
  hasFactory(type: ConnectorType | string): boolean;
  getSupportedTypes(): ConnectorType[];
}
