/**
 * @seltriva/runtime/configuration
 * Configuration Management — typed, watched, multi-source config
 *
 * Sources (in priority order, highest first):
 *   1. Environment variables
 *   2. Supabase remote configuration
 *   3. Platform-managed config files (JSON/YAML)
 *   4. Default values
 *
 * Features:
 *   - Namespaced keys to prevent collisions
 *   - Secret management with masking
 *   - Schema validation on load
 *   - Change watching (hot-reload for non-secret config)
 *   - Environment-specific overrides
 */

import type { RuntimeResult, RuntimeEnvironment, ModuleId, Disposable } from '../kernel/index';

// ─── Configuration Provider ───────────────────────────────────────────────

export interface ConfigurationProvider {
  /**
   * Get a typed value for a key
   */
  get<T = unknown>(key: ConfigKey): T | undefined;

  /**
   * Get a required value — throws ConfigurationMissingError if absent
   */
  require<T = unknown>(key: ConfigKey): T;

  /**
   * Get a value with a fallback default
   */
  getOrDefault<T>(key: ConfigKey, defaultValue: T): T;

  /**
   * Get all keys in a namespace
   */
  getNamespace<T extends Record<string, unknown>>(namespace: string): T;

  /**
   * Set a runtime configuration value (non-persistent)
   */
  set(key: ConfigKey, value: ConfigValue): void;

  /**
   * Delete a key
   */
  delete(key: ConfigKey): void;

  /**
   * Check if a key is set
   */
  has(key: ConfigKey): boolean;

  /**
   * Watch a key for changes — calls handler when value changes
   */
  watch(key: ConfigKey, handler: ConfigChangeHandler): Disposable;

  /**
   * Watch all keys in a namespace
   */
  watchNamespace(namespace: string, handler: ConfigChangeHandler): Disposable;

  /**
   * Reload configuration from all sources
   */
  reload(): Promise<RuntimeResult<void>>;

  /**
   * Validate configuration against a schema
   */
  validate(schema: ConfigurationSchema): ConfigValidationResult;

  /**
   * Get configuration metadata (source, last loaded, etc.)
   */
  getMeta(key: ConfigKey): ConfigKeyMeta | null;
}

// ─── Types ────────────────────────────────────────────────────────────────

export type ConfigKey   = string;
export type ConfigValue = string | number | boolean | string[] | Record<string, unknown> | null;

export type ConfigChangeHandler = (change: ConfigChange) => void;

export interface ConfigChange {
  readonly key: ConfigKey;
  readonly previousValue: ConfigValue | undefined;
  readonly newValue: ConfigValue | undefined;
  readonly source: ConfigSourceKind;
  readonly changedAt: Date;
}

// ─── Configuration Schema ─────────────────────────────────────────────────

export interface ConfigurationSchema {
  readonly namespace: string;
  readonly entries: ConfigSchemaEntry[];
}

export interface ConfigSchemaEntry {
  readonly key: ConfigKey;
  readonly type: ConfigValueType;
  readonly required: boolean;
  readonly defaultValue?: ConfigValue;
  readonly description?: string;
  readonly secret?: boolean;
  readonly allowedValues?: ConfigValue[];
  readonly validator?: (value: ConfigValue) => boolean;
}

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'url' | 'port' | 'duration-ms';

export interface ConfigValidationResult {
  readonly isValid: boolean;
  readonly errors: ConfigValidationError[];
  readonly warnings: string[];
}

export interface ConfigValidationError {
  readonly key: ConfigKey;
  readonly code: 'missing-required' | 'wrong-type' | 'invalid-value' | 'validation-failed';
  readonly message: string;
}

// ─── Configuration Sources ────────────────────────────────────────────────

export type ConfigSourceKind =
  | 'environment'     // process.env
  | 'supabase'        // Supabase remote config table
  | 'file'            // JSON/YAML file
  | 'default'         // schema defaults
  | 'runtime-set';    // set programmatically at runtime

export interface ConfigSource {
  readonly kind: ConfigSourceKind;
  readonly priority: number;
  readonly name: string;

  load(): Promise<RuntimeResult<Record<ConfigKey, ConfigValue>>>;
  canWatch(): boolean;
  watch(handler: ConfigChangeHandler): Disposable;
}

export interface ConfigKeyMeta {
  readonly key: ConfigKey;
  readonly source: ConfigSourceKind;
  readonly loadedAt: Date;
  readonly isSecret: boolean;
  readonly namespace: string;
}

// ─── Platform Configuration Namespaces ───────────────────────────────────

export const CONFIG_NAMESPACES = {
  PLATFORM:      'platform',
  DATABASE:      'database',
  SUPABASE:      'supabase',
  AI:            'ai',
  SCHEDULER:     'scheduler',
  WORKER:        'worker',
  TELEMETRY:     'telemetry',
  HEALTH:        'health',
  RESILIENCE:    'resilience',
  SECURITY:      'security',
  CACHE:         'cache',
  QUEUE:         'queue',
} as const;

export type ConfigNamespace = (typeof CONFIG_NAMESPACES)[keyof typeof CONFIG_NAMESPACES];

// ─── Built-in Config Keys ──────────────────────────────────────────────────

export const CONFIG_KEYS = {
  // Platform
  PLATFORM_ENV:              'platform.environment',
  PLATFORM_VERSION:          'platform.version',
  PLATFORM_NAME:             'platform.name',
  PLATFORM_REGION:           'platform.region',
  PLATFORM_LOG_LEVEL:        'platform.log_level',
  PLATFORM_SHUTDOWN_TIMEOUT: 'platform.shutdown_timeout_ms',

  // Database
  DATABASE_URL:              'database.url',
  DATABASE_POOL_MIN:         'database.pool.min',
  DATABASE_POOL_MAX:         'database.pool.max',

  // Supabase
  SUPABASE_URL:              'supabase.url',
  SUPABASE_ANON_KEY:         'supabase.anon_key',
  SUPABASE_SERVICE_KEY:      'supabase.service_role_key',

  // Scheduler
  SCHEDULER_MAX_CONCURRENT:  'scheduler.max_concurrent',
  SCHEDULER_TIMEZONE:        'scheduler.timezone',

  // Worker
  WORKER_POOL_SIZE:          'worker.pool_size',
  WORKER_TASK_TIMEOUT_MS:    'worker.task_timeout_ms',

  // Resilience
  CIRCUIT_BREAKER_THRESHOLD: 'resilience.circuit_breaker.failure_threshold',
  RETRY_MAX_ATTEMPTS:        'resilience.retry.max_attempts',
} as const;

// ─── Secret Provider ──────────────────────────────────────────────────────

/**
 * Secrets are kept separate from regular configuration.
 * Values are never logged; access is audited.
 */
export interface SecretProvider {
  getSecret(name: string): Promise<string | null>;
  requireSecret(name: string): Promise<string>;
  setSecret(name: string, value: string): Promise<void>;
  listSecretNames(): Promise<string[]>;
  rotateSecret(name: string): Promise<RuntimeResult<void>>;
}

// ─── Feature Flags ────────────────────────────────────────────────────────

export interface FeatureFlagProvider {
  isEnabled(flag: string, context?: Record<string, unknown>): boolean;
  getVariant(flag: string, context?: Record<string, unknown>): string | null;
  listFlags(): FeatureFlag[];
  registerFlag(flag: FeatureFlag): void;
}

export interface FeatureFlag {
  readonly name: string;
  readonly description: string;
  readonly defaultValue: boolean;
  readonly variants?: string[];
  readonly rolloutPercent?: number;
}
