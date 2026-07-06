/**
 * @seltriva/runtime
 * Connect Runtime Platform (CRP) — root barrel
 *
 * Exports all public contracts from all 18 modules.
 * Use sub-path imports for tree-shaking in production builds.
 */

// ─── Kernel (foundation) ──────────────────────────────────────────────────
export type {
  RuntimeResult,
  RuntimeError,
  RuntimeErrorCode,
  PlatformMetadata,
  RuntimeVersion,
  RuntimeEnvironment,
  ModuleDescriptor,
  ModuleKind,
  RuntimeContext,
  Disposable,
  Token,
  PlatformEventName,
  Severity,
  Priority,
  LogLevel,
  TimeRange,
  PlatformKernel,
  // Branded IDs
  ModuleId,
  ServiceId,
  PluginId,
  WorkerId,
  WorkerPoolId,
  JobId,
  ScheduleId,
  CommandId,
  EventId,
  CorrelationId,
  TraceId,
  SpanId,
  PermissionId,
  SandboxId,
} from './kernel/index';

export { PLATFORM_EVENTS } from './kernel/index';

// ─── Configuration ────────────────────────────────────────────────────────
export type {
  ConfigurationProvider,
  ConfigKey,
  ConfigValue,
  ConfigChangeHandler,
  ConfigChange,
  ConfigurationSchema,
  ConfigSchemaEntry,
  ConfigValueType,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigSourceKind,
  ConfigSource,
  ConfigKeyMeta,
  ConfigNamespace,
  SecretProvider,
  FeatureFlagProvider,
  FeatureFlag,
} from './configuration/index';

export { CONFIG_NAMESPACES, CONFIG_KEYS } from './configuration/index';

// ─── Lifecycle ────────────────────────────────────────────────────────────
export type {
  LifecycleState,
  Lifecycle,
  LifecycleModule,
  LifecycleHealthStatus,
  LifecycleManager,
  LifecycleTransitionEvent,
  LifecycleTransitionHandler,
  LifecycleHook,
  LifecycleHookPhase,
  LifecycleObserver,
  LifecycleDependencyGraph,
} from './lifecycle/index';

// ─── Permissions ──────────────────────────────────────────────────────────
export type {
  PermissionModel,
  PermissionDefinition,
  PermissionGrant,
  PermissionRequest,
  PermissionCheckResult,
  PermissionPrincipal,
  ResourceKind,
  ResourceAction,
  PermissionScope,
  PermissionCondition,
  PermissionConditionKind,
  BuiltInPermissionId,
  PermissionRole,
  PermissionAuditEntry,
  PermissionAuditFilter,
} from './permissions/index';

export { PERMISSION_IDS, BUILT_IN_ROLES } from './permissions/index';

// ─── Telemetry ────────────────────────────────────────────────────────────
export type {
  TelemetryProvider,
  RuntimeLogger,
  LogContext,
  LogBindings,
  LogRecord,
  RuntimeTracer,
  Span,
  SpanContext,
  SpanOptions,
  SpanLink,
  SpanKind,
  SpanStatus,
  RuntimeMeter,
  MetricOptions,
  MetricLabels,
  Counter,
  Gauge,
  Histogram,
  UpDownCounter,
  TelemetryExporter,
  ExportedSpan,
  MetricDataPoint,
} from './telemetry/index';

export { METRIC_NAMES } from './telemetry/index';

// ─── Event Bus ────────────────────────────────────────────────────────────
export type {
  EventBus,
  DomainEvent,
  EventMetadata,
  EventTopic,
  EventTopicPattern,
  EventHandler,
  EventEnvelope,
  SubscriptionOptions,
  EventSubscription,
  EventPublishResult,
  EventDeadLetter,
  DeadLetterFilter,
  EventBusStats,
  EventStore,
  BuiltInEventTopic,
} from './event-bus/index';

export { EVENT_TOPICS } from './event-bus/index';

// ─── Command Bus ──────────────────────────────────────────────────────────
export type {
  CommandBus,
  Command,
  CommandMetadata,
  CommandHandler,
  CommandHandlerContext,
  CommandMiddleware,
  CommandMiddlewareNext,
  DispatchOptions,
  BuiltInCommandType,
  CommandBusStats,
  CommandLog,
  CommandStore,
} from './command-bus/index';

export { COMMAND_TYPES } from './command-bus/index';

// ─── Service Registry ─────────────────────────────────────────────────────
export type {
  ServiceRegistry,
  ServiceScope,
  ServiceDescriptor,
  ServiceLifetime,
  ServiceFactory,
  ContainerBuilder,
  ContainerModule,
  ServiceHealthIndicator,
} from './service-registry/index';

export { SERVICE_TOKENS } from './service-registry/index';

// ─── Health ───────────────────────────────────────────────────────────────
export type {
  HealthMonitor,
  HealthCheck,
  HealthProbeKind,
  HealthStatus,
  HealthCheckResult,
  HealthReport,
  HealthStatusChangeHandler,
  HealthStatusChange,
  HealthEndpointFormatter,
  HealthEndpointResponse,
  DependencyHealthChecker,
  HealthStats,
} from './health/index';

export { HEALTH_CHECK_IDS } from './health/index';

// ─── Resilience ───────────────────────────────────────────────────────────
export type {
  ResilienceFactory,
  ResiliencePolicy,
  ResilienceOperation,
  ResiliencePolicyKind,
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOptions,
  CircuitBreakerMetrics,
  CircuitStateChangeHandler,
  RetryPolicy,
  RetryOptions,
  RetryMetrics,
  BulkheadPolicy,
  BulkheadOptions,
  BulkheadMetrics,
  TimeoutPolicy,
  TimeoutOptions,
  RateLimiter,
  RateLimiterOptions,
  RateLimiterMetrics,
  FallbackPolicy,
  FallbackOptions,
  ResiliencePipeline,
  ResilienceRegistry,
  ResilienceMetricsSnapshot,
} from './resilience/index';

// ─── Sandbox ──────────────────────────────────────────────────────────────
export type {
  SandboxManager,
  Sandbox,
  SandboxLevel,
  SandboxPolicy,
  SandboxViolationAction,
  SandboxCapability,
  ResourceQuota,
  SandboxViolation,
  SandboxViolationKind,
  SandboxStats,
  SandboxResourceReport,
} from './sandbox/index';

export { CAPABILITY_SETS } from './sandbox/index';

// ─── Plugin Manager ───────────────────────────────────────────────────────
export type {
  PluginManager,
  PluginManifest,
  PluginDependency,
  PluginRegistration,
  PluginState,
  Plugin,
  PluginContext,
  PluginEventKind,
  PluginEvent,
  PluginEventHandler,
  PluginValidator,
  PluginValidationResult,
  PluginConflict,
  PluginCapabilityCheck,
  PluginManagerStats,
} from './plugin-manager/index';

// ─── Module Loader ────────────────────────────────────────────────────────
export type {
  ModuleLoader,
  ModuleManifest,
  ModuleSource,
  WorkspaceModuleSource,
  FileModuleSource,
  NpmModuleSource,
  RemoteModuleSource,
  LoadedModule,
  ModuleCatalog,
  ModuleCatalogQuery,
  ModuleVersionRegistry,
  ModuleLoaderEventKind,
  ModuleLoaderEvent,
  ModuleLoaderEventHandler,
} from './module-loader/index';

// ─── Scheduler ────────────────────────────────────────────────────────────
export type {
  Scheduler,
  JobDefinition,
  JobDescriptor,
  JobHandler,
  JobExecutionContext,
  JobResult,
  JobTrigger,
  CronTrigger,
  IntervalTrigger,
  OnceTrigger,
  EventTrigger,
  JobExecution,
  JobExecutionStatus,
  JobRetryPolicy,
  TriggerOptions,
  SchedulerStats,
  JobExecutionEventKind,
  JobExecutionEvent,
  JobExecutionEventHandler,
  JobStore,
} from './scheduler/index';

export { BUILT_IN_JOB_IDS } from './scheduler/index';

// ─── Worker Pool ──────────────────────────────────────────────────────────
export type {
  WorkerPoolManager,
  WorkerPool,
  WorkerPoolConfig,
  PriorityWeights,
  PooledWorker,
  WorkerStatus,
  PooledTask,
  WorkerTaskFn,
  WorkerFactory,
  WorkerPoolStats,
  WorkerPoolManagerStats,
  WorkerPoolEventKind,
  WorkerPoolEvent,
  WorkerPoolEventHandler,
} from './worker-pool/index';

// ─── Diagnostics ──────────────────────────────────────────────────────────
export type {
  DiagnosticsProvider,
  PlatformSnapshot,
  PlatformStateView,
  ModuleStateView,
  ServiceStateView,
  JobStateView,
  WorkerPoolStateView,
  PluginStateView,
  ResilienceStateView,
  HealthStateView,
  PlatformTopology,
  TopologyNode,
  TopologyEdge,
  DiagnosticCheck,
  DiagnosticCategory,
  DiagnosticCheckResult,
  DiagnosticReport,
  AuditEntry,
  AuditCategory,
  AuditFilter,
  MemoryProfile,
  DependencyGraphView,
} from './diagnostics/index';

// ─── Orchestration ────────────────────────────────────────────────────────
export type {
  Orchestrator,
  OrchestrationPlan,
  OrchestrationStep,
  StepAction,
  CommandStepAction,
  EventStepAction,
  ServiceCallStepAction,
  WaitStepAction,
  BranchStepAction,
  StepCondition,
  OrchestrationResult,
  OrchestrationCompletionStatus,
  StepResult,
  OrchestrationStatus,
  WorkflowDefinition,
  OrchestrationEventKind,
  OrchestrationEvent,
  OrchestrationEventHandler,
  SagaCoordinator,
  SagaState,
} from './orchestration/index';

export { WORKFLOW_IDS } from './orchestration/index';

// ─── Bootstrap ────────────────────────────────────────────────────────────
export type {
  PlatformBuilder,
  PlatformContext,
  BootstrapPhase,
  BootstrapResult,
  BootstrapPhaseResult,
  BootstrapTaskResult,
  BootstrapTask,
  BootstrapExecutionContext,
  BootstrapConfigSource,
  BootstrapContainerModule,
  BootstrapHook,
  BootstrapObserver,
  BuiltInBootstrapTaskId,
} from './bootstrap/index';

export { BOOTSTRAP_PHASE_ORDER, BOOTSTRAP_TASK_IDS } from './bootstrap/index';
