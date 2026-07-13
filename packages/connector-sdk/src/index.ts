// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  Connector,
  ConnectorFactory,
  ConnectorResult,
  ConnectorError,
  DiscoveredEntity,
  DiscoveryResult,
  ValidationResult,
  ValidationIssue,
  SyncContext,
  SyncResult,
  SyncError,
  ConnectorHealthStatus,
  HealthStatusKind,
} from './interfaces/connector.js';
export { ok, fail } from './interfaces/connector.js';

export type {
  ConnectorMetadata,
  ConnectorCategory,
  ConnectorCapabilities,
  ConnectorDependency,
  ConnectorPermission,
} from './interfaces/metadata.js';

export type { VersionRange } from './interfaces/version.js';
export { compareVersions, satisfiesRange, isValidVersion } from './interfaces/version.js';

// ─── Events ───────────────────────────────────────────────────────────────────
export type {
  ConnectorEventMap,
  ConnectorEventType,
  ConnectorStartedEvent,
  ConnectorStoppedEvent,
  ConnectorFailedEvent,
  SyncStartedEvent,
  SyncFinishedEvent,
  HealthChangedEvent,
  DiscoveryFinishedEvent,
} from './events/connector-events.js';
export { EventBus } from './events/event-bus.js';

// ─── Scheduler ────────────────────────────────────────────────────────────────
export type { ScheduleEntry } from './scheduler/connector-scheduler.js';
export { ConnectorScheduler } from './scheduler/connector-scheduler.js';

// ─── Security ─────────────────────────────────────────────────────────────────
export { sha256, verifyHash, HashMismatchError } from './security/hash-verifier.js';
export {
  TrustedKeyRegistry,
  SignatureVerifier,
  SignatureVerificationError,
} from './security/signature-verifier.js';

// ─── Configuration ────────────────────────────────────────────────────────────
export type { ConfigField, ConfigSchema } from './configuration/config-schema.js';
export { ConfigValidationError, validateConfig } from './configuration/config-schema.js';
export type { ConfigStore } from './configuration/config-store.js';
export { InMemoryConfigStore, ConfigMissingError } from './configuration/config-store.js';

// ─── Credentials ──────────────────────────────────────────────────────────────
export type { CredentialStore } from './credentials/credential-store.js';
export { CredentialNotFoundError } from './credentials/credential-store.js';
export { InMemoryCredentialStore } from './credentials/in-memory-credential-store.js';

// ─── Health ───────────────────────────────────────────────────────────────────
export type { HealthSnapshot } from './health/health-status.js';
export { isHealthy, aggregateStatus } from './health/health-status.js';
export { HealthRegistry } from './health/health-registry.js';

// ─── Logging ──────────────────────────────────────────────────────────────────
export type { LogLevel, LogEntry, ConnectorLogger } from './logging/connector-logger.js';
export { ConsoleConnectorLogger, InMemoryConnectorLogger } from './logging/connector-logger.js';

// ─── Loader ───────────────────────────────────────────────────────────────────
export type { PluginManifest } from './loader/plugin-manifest.js';
export { validateManifest, PluginManifestError } from './loader/plugin-manifest.js';
export type { LoadedPlugin, PluginLoaderOptions } from './loader/plugin-loader.js';
export { PluginLoader, PluginLoadError } from './loader/plugin-loader.js';

// ─── Core ─────────────────────────────────────────────────────────────────────
export type { ConnectorContext } from './core/connector-context.js';
export type { PluginStatus, PluginEntry } from './core/plugin-registry.js';
export { PluginRegistry } from './core/plugin-registry.js';
export type { ConnectorHostOptions } from './core/connector-host.js';
export { ConnectorHost } from './core/connector-host.js';
