/**
 * @seltriva/agent — configuration
 * YAML-based configuration with Zod schema validation.
 *
 * Configuration file resolution order (highest priority first):
 *   1. --config CLI flag path
 *   2. SELTRIVA_AGENT_CONFIG env var
 *   3. ./agent.yaml  (current working directory)
 *   4. ~/.seltriva/agent.yaml
 *   5. /etc/seltriva/agent.yaml
 *
 * All secrets (API keys, passwords) are stored in the CredentialStore —
 * the config file holds only non-secret references.
 */

import type { Disposable } from '../runtime/index';

// ─── Result Wrapper ───────────────────────────────────────────────────────

export interface AgentResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: AgentError;
  readonly timestamp: Date;
}

export interface AgentError {
  readonly code: AgentErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type AgentErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'CONFIG_PARSE_ERROR'
  | 'CREDENTIAL_NOT_FOUND'
  | 'CREDENTIAL_DECRYPT_FAILED'
  | 'CONNECTOR_UNREACHABLE'
  | 'CONNECTOR_AUTH_FAILED'
  | 'SYNC_FAILED'
  | 'CLOUD_UNREACHABLE'
  | 'CLOUD_AUTH_FAILED'
  | 'UPDATE_DOWNLOAD_FAILED'
  | 'UPDATE_SIGNATURE_INVALID'
  | 'PLUGIN_LOAD_FAILED'
  | 'PERMISSION_DENIED'
  | 'INTERNAL_ERROR';

// ─── Branded IDs ──────────────────────────────────────────────────────────

export type AgentId       = string & { readonly __brand: 'AgentId' };
export type ConnectorId   = string & { readonly __brand: 'ConnectorId' };
export type SyncJobId     = string & { readonly __brand: 'SyncJobId' };
export type CredentialId  = string & { readonly __brand: 'CredentialId' };
export type PluginId      = string & { readonly __brand: 'PluginId' };
export type CacheKey      = string & { readonly __brand: 'CacheKey' };
export type TraceId       = string & { readonly __brand: 'TraceId' };

// ─── Configuration Schema ─────────────────────────────────────────────────

export interface AgentConfig {
  readonly agent: AgentSection;
  readonly security: SecuritySection;
  readonly connectors: ConnectorsSection;
  readonly sync: SyncSection;
  readonly scheduler: SchedulerSection;
  readonly health: HealthSection;
  readonly telemetry: TelemetrySection;
  readonly updates: UpdatesSection;
  readonly cache: CacheSection;
  readonly plugins: PluginsSection;
  readonly logs: LogsSection;
}

export interface AgentSection {
  /** Unique identifier for this agent instance */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Seltriva Connect Platform URL */
  readonly platform_url: string;
  /** Environment: development | staging | production */
  readonly environment: AgentEnvironment;
  /** Agent data directory */
  readonly data_dir: string;
  /** Working directory for temporary files */
  readonly work_dir: string;
}

export type AgentEnvironment = 'development' | 'staging' | 'production';

export interface SecuritySection {
  readonly tls: TLSConfigSection;
  readonly credentials: CredentialsConfigSection;
  readonly tokens: TokensConfigSection;
}

export interface TLSConfigSection {
  /** Minimum TLS version — must be 1.3 in production */
  readonly min_version: '1.2' | '1.3';
  readonly cert_path?: string;
  readonly key_path?: string;
  readonly ca_path?: string;
  readonly verify_hostname: boolean;
  readonly reject_unauthorized: boolean;
}

export interface CredentialsConfigSection {
  /** Path to the AES-256 encryption key file */
  readonly encryption_key_path: string;
  /** How often to rotate encryption keys (hours) */
  readonly rotation_interval_hours: number;
  /** Use OS keychain if available */
  readonly use_keychain: boolean;
}

export interface TokensConfigSection {
  readonly rotation_enabled: boolean;
  readonly rotation_interval_hours: number;
}

export interface ConnectorsSection {
  readonly database: DatabaseConnectorConfig[];
}

export interface DatabaseConnectorConfig {
  readonly id: string;
  readonly name: string;
  readonly type: DatabaseType;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  /** Credential reference — actual password is in CredentialStore */
  readonly credential_id: string;
  readonly ssl: boolean;
  readonly pool_size?: number;
  readonly connect_timeout_ms?: number;
  readonly enabled: boolean;
}

export type DatabaseType =
  | 'postgres'
  | 'mysql'
  | 'mssql'
  | 'oracle'
  | 'sqlite'
  | 'mariadb';

export interface SyncSection {
  readonly mode: SyncMode;
  readonly interval_ms: number;
  readonly batch_size: number;
  readonly max_retries: number;
  readonly retry_delay_ms: number;
  readonly offline_queue: OfflineQueueConfig;
  readonly checkpoint_dir: string;
}

export type SyncMode = 'manual' | 'scheduled' | 'incremental' | 'event-driven';

export interface OfflineQueueConfig {
  readonly enabled: boolean;
  readonly max_size: number;
  readonly persist_path: string;
  readonly flush_interval_ms: number;
  readonly max_age_hours: number;
}

export interface SchedulerSection {
  readonly enabled: boolean;
  readonly timezone: string;
  readonly jobs: ScheduledJobConfig[];
}

export interface ScheduledJobConfig {
  readonly id: string;
  readonly name: string;
  readonly trigger: 'manual' | 'cron' | 'interval' | 'event';
  readonly expression?: string;
  readonly interval_ms?: number;
  readonly event_topic?: string;
  readonly enabled: boolean;
  readonly timeout_ms?: number;
}

export interface HealthSection {
  readonly check_interval_ms: number;
  readonly heartbeat_interval_ms: number;
  readonly thresholds: HealthThresholdsConfig;
}

export interface HealthThresholdsConfig {
  readonly cpu_percent: number;
  readonly memory_percent: number;
  readonly disk_percent: number;
  readonly latency_ms: number;
}

export interface TelemetrySection {
  readonly log_level: LogLevel;
  readonly metrics_enabled: boolean;
  readonly trace_enabled: boolean;
  readonly exporters: TelemetryExporterConfig[];
}

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface TelemetryExporterConfig {
  readonly type: 'otlp' | 'prometheus' | 'datadog' | 'custom';
  readonly endpoint?: string;
  readonly credential_id?: string;
}

export interface UpdatesSection {
  readonly channel: UpdateChannel;
  readonly auto_update: boolean;
  readonly check_interval_hours: number;
  readonly verify_signature: boolean;
  readonly update_server_url: string;
  readonly backup_before_update: boolean;
}

export type UpdateChannel = 'stable' | 'beta' | 'edge';

export interface CacheSection {
  readonly enabled: boolean;
  readonly max_size_mb: number;
  readonly ttl_seconds: number;
  readonly persist_path: string;
}

export interface PluginsSection {
  readonly enabled: boolean;
  readonly directories: string[];
  readonly auto_load: boolean;
  readonly allowed_ids?: string[];
}

export interface LogsSection {
  readonly directory: string;
  readonly max_file_size_mb: number;
  readonly max_files: number;
  readonly compress_old_files: boolean;
  readonly retention_days: number;
}

// ─── Configuration Provider ───────────────────────────────────────────────

export interface ConfigurationProvider {
  /**
   * Load and validate the configuration from a file path.
   * Returns a validated AgentConfig or throws AgentError.
   */
  load(filePath?: string): Promise<AgentResult<AgentConfig>>;

  /**
   * Get the currently loaded configuration.
   * Throws if load() has not been called.
   */
  get(): AgentConfig;

  /**
   * Reload configuration from disk (hot-reload)
   */
  reload(): Promise<AgentResult<AgentConfig>>;

  /**
   * Watch for config file changes
   */
  watch(handler: ConfigChangeHandler): Disposable;

  /**
   * Validate a raw config object against the schema
   */
  validate(raw: unknown): ConfigValidationResult;

  /**
   * Generate a default configuration file
   */
  generateDefault(outputPath: string): Promise<AgentResult<void>>;

  /**
   * True if configuration has been loaded
   */
  readonly isLoaded: boolean;

  /**
   * Path of the loaded configuration file
   */
  readonly filePath?: string;
}

export interface ConfigValidationResult {
  readonly valid: boolean;
  readonly errors: ConfigValidationError[];
}

export interface ConfigValidationError {
  readonly path: string;
  readonly message: string;
  readonly received?: unknown;
  readonly expected?: string;
}

export type ConfigChangeHandler = (config: AgentConfig, previous: AgentConfig) => void;

// ─── Default Configuration ────────────────────────────────────────────────

export const DEFAULT_CONFIG_PATHS = [
  './agent.yaml',
  './seltriva-agent.yaml',
  '~/.seltriva/agent.yaml',
  '/etc/seltriva/agent.yaml',
] as const;

export const DEFAULT_PLATFORM_URL = 'https://connect.seltriva.com' as const;

export const CONFIG_ENV_VAR = 'SELTRIVA_AGENT_CONFIG' as const;
