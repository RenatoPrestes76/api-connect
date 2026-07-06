/**
 * @seltriva/core/configuration
 * Configuration management interfaces — Strategy Pattern for config sources
 */

/**
 * Central configuration manager
 */
export interface ConfigurationManager {
  get<T = unknown>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  getSection(section: string): Record<string, unknown>;
  merge(config: Record<string, unknown>): void;
  loadFromFile(path: string): Promise<void>;
  loadFromEnvironment(): Promise<void>;
  loadFromRemote(url: string): Promise<void>;
  validate(schema: ConfigurationSchema): Promise<ConfigValidationResult>;
  getAll(): Record<string, unknown>;
  clear(): void;
  watch(key: string, callback: (newValue: unknown, oldValue: unknown) => void): void;
  unwatch(key: string): void;
  isReadonly(): boolean;
}

/**
 * JSON Schema-like descriptor for config validation
 */
export interface ConfigurationSchema {
  readonly type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  readonly properties?: Record<string, ConfigurationSchema>;
  readonly required?: string[];
  readonly enum?: unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly default?: unknown;
  readonly description?: string;
}

/**
 * Result of config schema validation
 */
export interface ConfigValidationResult {
  readonly isValid: boolean;
  readonly errors?: Record<string, string[]>;
}

/**
 * Strategy: a single source that can provide configuration values
 */
export interface ConfigurationProvider {
  load(): Promise<Record<string, unknown>>;
  getName(): string;
  getPriority(): number;
  isAvailable(): Promise<boolean>;
}

/**
 * Environment variable config provider (e.g., SELTRIVA_*)
 */
export interface EnvironmentConfigurationProvider extends ConfigurationProvider {
  readonly prefix: string;
  readonly transformer?: (key: string) => string;
}

/**
 * File-based config provider (.json, .yaml, .env)
 */
export interface FileConfigurationProvider extends ConfigurationProvider {
  readonly filePath: string;
  readonly format: 'json' | 'yaml' | 'env';
  watchFile?(): Promise<void>;
}

/**
 * Remote config provider (Consul, Vault, SSM Parameter Store, etc.)
 */
export interface RemoteConfigurationProvider extends ConfigurationProvider {
  readonly url: string;
  readonly cacheDuration?: number;
  readonly token?: string;
  readonly pollInterval?: number;
}

/**
 * Secret provider — retrieves sensitive values from a secrets backend
 */
export interface SecretProvider {
  getSecret(path: string): Promise<string>;
  listSecrets(prefix: string): Promise<string[]>;
  getName(): string;
}

/**
 * Composed loader that merges multiple providers in priority order
 */
export interface ConfigurationLoader {
  addProvider(provider: ConfigurationProvider): void;
  removeProvider(name: string): void;
  load(): Promise<Record<string, unknown>>;
  getProviders(): ConfigurationProvider[];
}
