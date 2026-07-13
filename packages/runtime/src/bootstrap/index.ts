/**
 * @seltriva/runtime/bootstrap
 * Bootstrap — platform startup sequence and initialization
 *
 * The bootstrap sequence is a strict, ordered pipeline:
 *
 *   Phase 1: CONFIGURATION
 *     Load environment variables, config files, Supabase remote config.
 *     Validate all required keys against the platform schema.
 *
 *   Phase 2: DEPENDENCY_INJECTION
 *     Build the service container. Register all core platform services.
 *     No module is started yet.
 *
 *   Phase 3: SERVICE_REGISTRATION
 *     Initialize and register infrastructure services:
 *     database client, Supabase client, cache, queue, etc.
 *
 *   Phase 4: PLUGIN_LOADING
 *     Discover plugins from configured directories.
 *     Validate manifests, create sandboxes, init each plugin.
 *
 *   Phase 5: SCHEDULER_INIT
 *     Register built-in recurring jobs.
 *     Start the scheduler clock.
 *
 *   Phase 6: WORKER_INIT
 *     Spawn worker pools.
 *     Wait for all workers to reach idle state.
 *
 *   Phase 7: READY
 *     Emit platform.ready event.
 *     Platform accepts external traffic.
 *
 * Each phase runs its own set of BootstrapTasks.
 * A phase failure aborts the remaining phases and triggers a clean shutdown.
 */

import type {
  RuntimeResult,
  PlatformMetadata,
  RuntimeEnvironment,
  Disposable,
} from '../kernel/index';
import type { ServiceRegistry, ContainerBuilder } from '../service-registry/index';

// ─── Platform Builder ─────────────────────────────────────────────────────

/**
 * Fluent builder for assembling a platform instance before bootstrapping.
 * Inspired by ASP.NET WebApplicationBuilder and NestJS ApplicationBuilder.
 */
export interface PlatformBuilder {
  /**
   * Set platform metadata
   */
  withMetadata(metadata: Partial<PlatformMetadata>): this;

  /**
   * Set the runtime environment (defaults to NODE_ENV)
   */
  withEnvironment(env: RuntimeEnvironment): this;

  /**
   * Add a configuration source (called in priority order)
   */
  addConfigSource(source: BootstrapConfigSource): this;

  /**
   * Add a container module (registers services in DI)
   */
  addContainerModule(module: BootstrapContainerModule): this;

  /**
   * Register a bootstrap task in a specific phase
   */
  addTask(phase: BootstrapPhase, task: BootstrapTask): this;

  /**
   * Add a plugin directory to discover plugins from
   */
  addPluginDirectory(dirPath: string): this;

  /**
   * Override a bootstrap phase's timeout
   */
  setPhaseTimeout(phase: BootstrapPhase, timeoutMs: number): this;

  /**
   * Register a hook that runs before a phase starts
   */
  beforePhase(phase: BootstrapPhase, hook: BootstrapHook): this;

  /**
   * Register a hook that runs after a phase completes
   */
  afterPhase(phase: BootstrapPhase, hook: BootstrapHook): this;

  /**
   * Enable/disable a phase
   */
  skipPhase(phase: BootstrapPhase): this;

  /**
   * Execute the bootstrap sequence and return the running platform
   */
  bootstrap(): Promise<RuntimeResult<PlatformContext>>;
}

// ─── Platform Context ─────────────────────────────────────────────────────

/**
 * The fully initialized platform — returned after successful bootstrap.
 * This is the root object for the running Seltriva Connect instance.
 */
export interface PlatformContext {
  readonly metadata: PlatformMetadata;
  readonly environment: RuntimeEnvironment;
  readonly services: ServiceRegistry;

  /**
   * Gracefully shut down the platform
   */
  shutdown(reason?: string): Promise<void>;

  /**
   * Subscribe to shutdown
   */
  onShutdown(handler: () => void | Promise<void>): Disposable;

  /**
   * True when platform is fully operational
   */
  readonly isReady: boolean;

  /**
   * ISO timestamp of when the platform became ready
   */
  readonly readyAt?: Date;

  /**
   * Total bootstrap duration
   */
  readonly bootstrapDurationMs: number;
}

// ─── Bootstrap Phases ─────────────────────────────────────────────────────

export type BootstrapPhase =
  | 'configuration'
  | 'dependency-injection'
  | 'service-registration'
  | 'plugin-loading'
  | 'scheduler-init'
  | 'worker-init'
  | 'ready';

export const BOOTSTRAP_PHASE_ORDER: BootstrapPhase[] = [
  'configuration',
  'dependency-injection',
  'service-registration',
  'plugin-loading',
  'scheduler-init',
  'worker-init',
  'ready',
];

// ─── Bootstrap Result ─────────────────────────────────────────────────────

export interface BootstrapResult {
  readonly success: boolean;
  readonly context?: PlatformContext;
  readonly phaseResults: BootstrapPhaseResult[];
  readonly totalDurationMs: number;
  readonly failedPhase?: BootstrapPhase;
  readonly error?: Error;
}

export interface BootstrapPhaseResult {
  readonly phase: BootstrapPhase;
  readonly success: boolean;
  readonly taskResults: BootstrapTaskResult[];
  readonly durationMs: number;
  readonly error?: string;
}

export interface BootstrapTaskResult {
  readonly taskId: string;
  readonly taskName: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly error?: string;
  readonly output?: Record<string, unknown>;
}

// ─── Bootstrap Task ───────────────────────────────────────────────────────

export interface BootstrapTask {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly phase: BootstrapPhase;
  readonly order: number;
  readonly required: boolean;
  readonly timeoutMs?: number;

  execute(
    context: BootstrapExecutionContext
  ): Promise<RuntimeResult<Record<string, unknown> | void>>;
}

export interface BootstrapExecutionContext {
  readonly phase: BootstrapPhase;
  readonly environment: RuntimeEnvironment;
  readonly services: Partial<ServiceRegistry>;
  readonly metadata: Partial<PlatformMetadata>;
  readonly previousResults: Map<string, BootstrapTaskResult>;
  readonly signal: AbortSignal;
}

// ─── Bootstrap Config Source ──────────────────────────────────────────────

export interface BootstrapConfigSource {
  readonly kind: string;
  readonly priority: number;
  load(environment: RuntimeEnvironment): Promise<Record<string, unknown>>;
}

// ─── Bootstrap Container Module ───────────────────────────────────────────

export interface BootstrapContainerModule {
  readonly name: string;
  readonly order: number;
  configure(builder: ContainerBuilder, environment: RuntimeEnvironment): void;
}

// ─── Bootstrap Hook ───────────────────────────────────────────────────────

export type BootstrapHook = (context: BootstrapExecutionContext) => void | Promise<void>;

// ─── Built-in Bootstrap Tasks ─────────────────────────────────────────────

export const BOOTSTRAP_TASK_IDS = {
  // Configuration phase
  LOAD_ENV_CONFIG: 'bt-load-env-config',
  LOAD_FILE_CONFIG: 'bt-load-file-config',
  LOAD_SUPABASE_CONFIG: 'bt-load-supabase-config',
  VALIDATE_CONFIG: 'bt-validate-config',

  // DI phase
  BUILD_CONTAINER: 'bt-build-container',
  REGISTER_CORE_SERVICES: 'bt-register-core-services',

  // Service registration phase
  INIT_DATABASE: 'bt-init-database',
  INIT_SUPABASE: 'bt-init-supabase',
  INIT_CACHE: 'bt-init-cache',
  INIT_EVENT_BUS: 'bt-init-event-bus',
  INIT_COMMAND_BUS: 'bt-init-command-bus',
  INIT_TELEMETRY: 'bt-init-telemetry',
  INIT_HEALTH_MONITOR: 'bt-init-health-monitor',
  INIT_RESILIENCE: 'bt-init-resilience',
  INIT_PERMISSION_MODEL: 'bt-init-permission-model',

  // Plugin loading phase
  DISCOVER_PLUGINS: 'bt-discover-plugins',
  VALIDATE_PLUGINS: 'bt-validate-plugins',
  CREATE_SANDBOXES: 'bt-create-sandboxes',
  INIT_PLUGINS: 'bt-init-plugins',
  START_PLUGINS: 'bt-start-plugins',

  // Scheduler init phase
  REGISTER_BUILT_IN_JOBS: 'bt-register-built-in-jobs',
  START_SCHEDULER: 'bt-start-scheduler',

  // Worker init phase
  SPAWN_WORKER_POOLS: 'bt-spawn-worker-pools',
  WAIT_FOR_WORKERS: 'bt-wait-for-workers',

  // Ready phase
  EMIT_READY_EVENT: 'bt-emit-ready-event',
  START_HEALTH_POLLING: 'bt-start-health-polling',
  LOG_STARTUP_SUMMARY: 'bt-log-startup-summary',
} as const;

export type BuiltInBootstrapTaskId = (typeof BOOTSTRAP_TASK_IDS)[keyof typeof BOOTSTRAP_TASK_IDS];

// ─── Bootstrap Observer ───────────────────────────────────────────────────

export interface BootstrapObserver {
  onPhaseStarted(phase: BootstrapPhase): void;
  onPhaseCompleted(result: BootstrapPhaseResult): void;
  onPhaseFailed(phase: BootstrapPhase, error: Error): void;
  onTaskCompleted(result: BootstrapTaskResult): void;
  onBootstrapCompleted(result: BootstrapResult): void;
}
