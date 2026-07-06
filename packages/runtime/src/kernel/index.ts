/**
 * @seltriva/runtime/kernel
 * Platform Kernel — foundation types, branded IDs, and core contracts
 *
 * The kernel is the lowest layer of the CRP. Every other module
 * depends on the types defined here.
 *
 * Design principles:
 *   - No business logic — pure platform infrastructure
 *   - All IDs are branded strings (prevents cross-module ID confusion)
 *   - RuntimeResult<T> is the universal never-throws result wrapper
 *   - All modules implement Identifiable<TId> for uniform discovery
 */

// ─── Result Wrapper ───────────────────────────────────────────────────────

/** Universal never-throws result wrapper for all runtime operations */
export interface RuntimeResult<TData = void> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: RuntimeError;
  readonly durationMs?: number;
  readonly timestamp: Date;
}

export interface RuntimeError {
  readonly code: RuntimeErrorCode;
  readonly message: string;
  readonly moduleId?: ModuleId;
  readonly cause?: unknown;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
}

export type RuntimeErrorCode =
  | 'KERNEL_FAULT'
  | 'MODULE_NOT_FOUND'
  | 'MODULE_LOAD_FAILED'
  | 'MODULE_INIT_FAILED'
  | 'MODULE_START_FAILED'
  | 'MODULE_STOP_FAILED'
  | 'PLUGIN_INVALID'
  | 'PLUGIN_CONFLICT'
  | 'PLUGIN_SANDBOX_VIOLATION'
  | 'SERVICE_NOT_FOUND'
  | 'SERVICE_ALREADY_REGISTERED'
  | 'CONFIGURATION_MISSING'
  | 'CONFIGURATION_INVALID'
  | 'PERMISSION_DENIED'
  | 'WORKER_EXHAUSTED'
  | 'WORKER_FAULT'
  | 'JOB_FAILED'
  | 'JOB_TIMEOUT'
  | 'CIRCUIT_OPEN'
  | 'RATE_LIMITED'
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'EVENT_PUBLISH_FAILED'
  | 'ORCHESTRATION_FAILED'
  | 'BOOTSTRAP_FAILED'
  | 'HEALTH_CHECK_FAILED'
  | 'TELEMETRY_ERROR'
  | 'UNKNOWN';

// ─── Branded IDs ──────────────────────────────────────────────────────────

export type ModuleId        = string & { readonly __brand: 'ModuleId' };
export type ServiceId       = string & { readonly __brand: 'ServiceId' };
export type PluginId        = string & { readonly __brand: 'PluginId' };
export type WorkerId        = string & { readonly __brand: 'WorkerId' };
export type WorkerPoolId    = string & { readonly __brand: 'WorkerPoolId' };
export type JobId           = string & { readonly __brand: 'JobId' };
export type ScheduleId      = string & { readonly __brand: 'ScheduleId' };
export type CommandId       = string & { readonly __brand: 'CommandId' };
export type EventId         = string & { readonly __brand: 'EventId' };
export type CorrelationId   = string & { readonly __brand: 'CorrelationId' };
export type TraceId         = string & { readonly __brand: 'TraceId' };
export type SpanId          = string & { readonly __brand: 'SpanId' };
export type PermissionId    = string & { readonly __brand: 'PermissionId' };
export type SandboxId       = string & { readonly __brand: 'SandboxId' };

// ─── Identifiable ─────────────────────────────────────────────────────────

export interface Identifiable<TId extends string> {
  readonly id: TId;
}

// ─── Platform Metadata ────────────────────────────────────────────────────

export interface PlatformMetadata {
  readonly name: string;
  readonly version: RuntimeVersion;
  readonly environment: RuntimeEnvironment;
  readonly startedAt?: Date;
  readonly nodeVersion?: string;
  readonly region?: string;
  readonly instanceId?: string;
}

export interface RuntimeVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly label?: string;
  toString(): string;
}

export type RuntimeEnvironment = 'development' | 'test' | 'staging' | 'production';

// ─── Module Kinds ─────────────────────────────────────────────────────────

export type ModuleKind =
  | 'core'          // platform-internal modules (kernel, bootstrap)
  | 'infrastructure' // databases, queues, cache
  | 'integration'   // connector adapters
  | 'analytics'     // reporting, telemetry aggregation
  | 'ai'            // AI/ML modules
  | 'plugin'        // third-party plugins
  | 'extension';    // user-defined extensions

// ─── Module Descriptor ────────────────────────────────────────────────────

export interface ModuleDescriptor {
  readonly id: ModuleId;
  readonly name: string;
  readonly kind: ModuleKind;
  readonly version: string;
  readonly description: string;
  readonly dependencies: ModuleId[];
  readonly optionalDependencies?: ModuleId[];
  readonly provides: ServiceId[];
  readonly consumes: ServiceId[];
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
}

// ─── Runtime Context ──────────────────────────────────────────────────────

/**
 * The shared context passed to every module during initialization.
 * Carries platform metadata, correlation IDs, and shutdown signals.
 */
export interface RuntimeContext {
  readonly platform: PlatformMetadata;
  readonly correlationId: CorrelationId;
  readonly environment: RuntimeEnvironment;
  readonly shutdownSignal: AbortSignal;
  readonly startedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

// ─── Disposable ───────────────────────────────────────────────────────────

export interface Disposable {
  dispose(): Promise<void>;
}

export interface AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

// ─── Token (DI) ───────────────────────────────────────────────────────────

export type Token<T = unknown> = string | symbol | { readonly token: string | symbol; readonly __type?: T };

// ─── Platform Constants ───────────────────────────────────────────────────

export const PLATFORM_EVENTS = {
  BOOTSTRAP_STARTED:         'platform.bootstrap.started',
  BOOTSTRAP_PHASE_COMPLETED: 'platform.bootstrap.phase.completed',
  PLATFORM_READY:            'platform.ready',
  MODULE_REGISTERED:         'platform.module.registered',
  MODULE_STARTED:            'platform.module.started',
  MODULE_STOPPED:            'platform.module.stopped',
  MODULE_FAILED:             'platform.module.failed',
  PLUGIN_LOADED:             'platform.plugin.loaded',
  PLUGIN_UNLOADED:           'platform.plugin.unloaded',
  PLUGIN_FAULTED:            'platform.plugin.faulted',
  SERVICE_REGISTERED:        'platform.service.registered',
  SERVICE_UNREGISTERED:      'platform.service.unregistered',
  JOB_SCHEDULED:             'platform.job.scheduled',
  JOB_COMPLETED:             'platform.job.completed',
  JOB_FAILED:                'platform.job.failed',
  WORKER_SPAWNED:            'platform.worker.spawned',
  WORKER_TERMINATED:         'platform.worker.terminated',
  HEALTH_DEGRADED:           'platform.health.degraded',
  HEALTH_RECOVERED:          'platform.health.recovered',
  SHUTDOWN_INITIATED:        'platform.shutdown.initiated',
  SHUTDOWN_COMPLETED:        'platform.shutdown.completed',
} as const;

export type PlatformEventName = (typeof PLATFORM_EVENTS)[keyof typeof PLATFORM_EVENTS];

// ─── Severity / Priority ──────────────────────────────────────────────────

export type Severity  = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Priority  = 'critical' | 'high' | 'normal' | 'low' | 'background';
export type LogLevel  = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

// ─── Time Range ───────────────────────────────────────────────────────────

export interface TimeRange {
  readonly from: Date;
  readonly to: Date;
}

// ─── Kernel Interface ─────────────────────────────────────────────────────

/**
 * The platform kernel — top-level coordinator.
 * Implementations wire together the CRP's core subsystems.
 */
export interface PlatformKernel {
  readonly metadata: PlatformMetadata;
  readonly context: RuntimeContext;

  /** True when bootstrap has completed */
  readonly isReady: boolean;

  /** True when shutdown has been initiated */
  readonly isShuttingDown: boolean;

  /**
   * Gracefully shut down all modules in reverse dependency order
   */
  shutdown(reason?: string): Promise<void>;

  /**
   * Emit a platform-level event
   */
  emit(event: PlatformEventName, payload?: Record<string, unknown>): void;

  /**
   * Subscribe to a platform-level event
   */
  on(event: PlatformEventName, handler: (payload?: Record<string, unknown>) => void): Disposable;
}
