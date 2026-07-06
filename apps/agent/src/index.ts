/**
 * @seltriva/agent — Sentinel
 * Seltriva Connect Agent — enterprise edge agent.
 *
 * Entry point: starts the agent using the bootstrap sequence.
 * For CLI usage, the bin entry point is at src/cli/bin.ts.
 */

import { AGENT_BOOTSTRAP_PHASE_ORDER } from './bootstrap/index';

export { AGENT_BOOTSTRAP_PHASE_ORDER, AGENT_BOOTSTRAP_TASK_IDS } from './bootstrap/index';
export type {
  AgentBuilder,
  AgentInstance,
  AgentBootstrapPhase,
  AgentBootstrapResult,
  AgentPhaseResult,
  AgentBootstrapHook,
  AgentBootstrapObserver,
  AgentBuilderFactory,
} from './bootstrap/index';

export type {
  AgentConfig,
  AgentSection,
  SecuritySection,
  ConnectorsSection,
  SyncSection,
  SchedulerSection,
  HealthSection,
  TelemetrySection,
  UpdatesSection,
  CacheSection,
  PluginsSection,
  LogsSection,
  AgentEnvironment,
  DatabaseConnectorConfig,
  DatabaseType,
  SyncMode,
  UpdateChannel,
  LogLevel,
  ConfigurationProvider,
  ConfigValidationResult,
  AgentResult,
  AgentError,
  AgentErrorCode,
  AgentId,
  ConnectorId,
  SyncJobId,
  CredentialId,
  PluginId,
  CacheKey,
  TraceId,
} from './configuration/index';

export { DEFAULT_CONFIG_PATHS, CONFIG_ENV_VAR } from './configuration/index';

export type {
  CredentialStore,
  Credential,
  CredentialKind,
  EncryptionProvider,
  EncryptedPayload,
  TLSManager,
  TLSClientOptions,
  TLSPolicy,
  PeerCertificate,
  ParsedCertificate,
  CertificateValidationResult,
  TokenManager,
  SignatureVerifier,
  SignatureVerificationResult,
  SecurityAuditLog,
  SecurityAuditEvent,
  SecurityAuditEventKind,
} from './security/index';

export type {
  ConnectorManager,
  DatabaseConnector,
  CloudConnector,
  CloudSession,
  CloudPayload,
  CloudPayloadKind,
  HeartbeatPayload,
  CloudCommand,
  CloudCommandType,
  SchemaDescriptor,
  TableDescriptor,
  ColumnDescriptor,
  IndexDescriptor,
  RelationshipDescriptor,
  QueryResult,
  ConnectorDescriptor,
  ConnectorHealth,
  ConnectivityTestResult,
  DatabaseServerInfo,
} from './connectors/index';

export type {
  SyncEngine,
  SyncResult,
  SyncRunMode,
  SyncRunStatus,
  SyncChangeSummary,
  SyncStatus,
  SyncCheckpoint,
  SyncDiff,
  SchemaDiff,
  TableDiff,
  SchemaSnapshot,
  OfflineQueue,
  OfflineQueueEntry,
  OfflineQueueStats,
  SyncHistoryEntry,
  SyncEventKind,
  SyncEvent,
} from './sync/index';

export { DEFAULT_SYNC_RETRY_POLICY } from './sync/index';

export type {
  AgentScheduler,
  JobDefinition,
  JobTrigger,
  ManualTrigger,
  CronTrigger,
  IntervalTrigger,
  EventDrivenTrigger,
  JobHandler,
  JobExecutionContext,
  JobDescriptor,
  JobRun,
  JobRunStatus,
  TriggerReason,
  SchedulerStats,
} from './scheduler/index';

export { AGENT_JOB_IDS } from './scheduler/index';

export type {
  HealthMonitor,
  HealthCheck,
  HealthReport,
  HealthStatus,
  HealthCheckResult,
  SystemMetrics,
  CPUMetrics,
  MemoryMetrics,
  DiskMetrics,
  ProcessMetrics,
  NetworkMetrics,
  HeartbeatService,
  HeartbeatRecord,
} from './health/index';

export { HEALTH_CHECK_IDS } from './health/index';

export type {
  AgentTelemetry,
  AgentLogger,
  LogRecord,
  AgentMetrics,
  MetricSnapshot,
  AgentTracer,
  AgentSpan,
  TelemetryExporter,
  ExportedSpan,
} from './telemetry/index';

export { AGENT_METRICS } from './telemetry/index';

export type {
  UpdateManager,
  UpdateManifest,
  DownloadedUpdate,
  UpdateCheckResult,
  UpdateResult,
  UpdateStatus,
  RollbackTarget,
  UpdateHistoryEntry,
  UpdateEventKind,
  UpdateEvent,
} from './updates/index';

export type {
  AgentPluginManager,
  AgentPlugin,
  PluginManifest,
  PluginCapability,
  PluginContext,
  PluginEvent,
  PluginDescriptor,
  PluginState,
  PluginValidator,
} from './plugins/index';

export type {
  AgentCache,
  SchemaCache,
  KVCache,
  CacheStats,
} from './cache/index';

export { CACHE_PREFIXES } from './cache/index';

export type {
  AgentDiagnostics,
  DiagnosticCheck,
  DiagnosticCheckResult,
  DiagnosticReport,
  DiagnosticStatus,
  DiagnosticCategory,
  PreflightReport,
  DiagnosticBundle,
  DiagnosticSummary,
} from './diagnostics/index';

export { DIAGNOSTIC_CHECK_IDS } from './diagnostics/index';

export type {
  CLIApplication,
  CLICommand,
  CLIOutput,
  CLISpinner,
  DaemonManager,
  DaemonInfo,
  DaemonStatus,
} from './cli/index';

export type {
  LogManager,
  LogStream,
  LogStreamFilter,
  LogReadFilter,
  LogFileInfo,
  LogFormatter,
} from './logs/index';

export type {
  AgentServiceRegistry,
  AgentRegistrationService,
  AgentRegistration,
  AgentRegistrationRequest,
  CloudBridgeService,
  CloudBridgeState,
  OfflineQueueFlusher,
  FlushResult,
  ConnectorHealthService,
  ConnectorHealthRecord,
} from './services/index';

export type {
  AgentRuntime,
  AgentContext,
  ProcessRuntimeMetrics,
  PidFileManager,
  SignalHandler,
  Disposable,
} from './runtime/index';

// ─── Concrete Bootstrap Implementation ───────────────────────────────────

export { AgentBootstrapperImpl, createAgent } from './bootstrap/bootstrapper.js';

// ─── Version ──────────────────────────────────────────────────────────────

export const AGENT_VERSION = '0.1.0' as const;
export const AGENT_CODENAME = 'Sentinel' as const;
export const AGENT_BOOTSTRAP_PHASES = AGENT_BOOTSTRAP_PHASE_ORDER;
