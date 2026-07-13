/**
 * @seltriva/runtime/lifecycle
 * Lifecycle Contracts — every runtime module follows this state machine
 *
 * State machine:
 *
 *   created → initializing → initialized → starting → running
 *                                                        │
 *                                                    stopping → stopped → destroying → destroyed
 *
 *   Any state may transition to → error
 *   error → destroying → destroyed   (recovery path)
 *
 * Lifecycle hooks allow code to run at specific state transitions.
 * The LifecycleManager tracks all registered modules and
 * coordinates ordered startup / shutdown.
 */

import type {
  RuntimeResult,
  ModuleId,
  ModuleDescriptor,
  RuntimeContext,
  Disposable,
} from '../kernel/index';

// ─── Lifecycle State ──────────────────────────────────────────────────────

export type LifecycleState =
  | 'created'
  | 'initializing'
  | 'initialized'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'destroying'
  | 'destroyed'
  | 'error';

// ─── Lifecycle Interface ──────────────────────────────────────────────────

/**
 * Every CRP module implements this interface.
 * Transitions are managed by LifecycleManager — modules never self-transition.
 */
export interface Lifecycle {
  /**
   * Called once after construction.
   * Load configuration, validate dependencies, prepare internal state.
   * Module is NOT yet available to other modules.
   */
  init(context: RuntimeContext): Promise<RuntimeResult<void>>;

  /**
   * Called after all dependencies are initialized.
   * Bind ports, start internal goroutines, become available.
   */
  start(): Promise<RuntimeResult<void>>;

  /**
   * Called during platform shutdown.
   * Drain queues, close connections, finish in-flight operations.
   */
  stop(): Promise<RuntimeResult<void>>;

  /**
   * Called after stop(). Release all resources.
   * After this, the module instance is unusable.
   */
  destroy(): Promise<RuntimeResult<void>>;
}

// ─── Lifecycle-Aware Module ───────────────────────────────────────────────

/**
 * A module that participates fully in the platform lifecycle.
 */
export interface LifecycleModule extends Lifecycle {
  readonly descriptor: ModuleDescriptor;
  readonly state: LifecycleState;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
  readonly errorCount: number;
  readonly lastError?: Error;

  /**
   * Health check callable at any time during 'running' state
   */
  healthCheck(): Promise<LifecycleHealthStatus>;
}

export interface LifecycleHealthStatus {
  readonly healthy: boolean;
  readonly state: LifecycleState;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
}

// ─── Lifecycle Manager ────────────────────────────────────────────────────

/**
 * Orchestrates all registered modules through their lifecycle.
 * Respects dependency ordering on startup and reverse order on shutdown.
 */
export interface LifecycleManager {
  /**
   * Register a module with the lifecycle manager
   */
  register(module: LifecycleModule): void;

  /**
   * Unregister a module (must be in stopped or destroyed state)
   */
  unregister(moduleId: ModuleId): RuntimeResult<void>;

  /**
   * Initialize all registered modules in dependency order
   */
  initAll(context: RuntimeContext): Promise<RuntimeResult<void>>;

  /**
   * Start all initialized modules in dependency order
   */
  startAll(): Promise<RuntimeResult<void>>;

  /**
   * Stop all running modules in reverse dependency order
   */
  stopAll(): Promise<RuntimeResult<void>>;

  /**
   * Destroy all stopped modules
   */
  destroyAll(): Promise<RuntimeResult<void>>;

  /**
   * Get the current state of a module
   */
  getState(moduleId: ModuleId): LifecycleState | null;

  /**
   * Get all modules in a given state
   */
  getByState(state: LifecycleState): LifecycleModule[];

  /**
   * Get all registered modules
   */
  getAll(): LifecycleModule[];

  /**
   * Listen for state transitions on any module
   */
  onTransition(handler: LifecycleTransitionHandler): Disposable;

  /**
   * Wait until all modules reach the 'running' state
   */
  waitForReady(timeoutMs?: number): Promise<RuntimeResult<void>>;
}

// ─── Lifecycle Events ─────────────────────────────────────────────────────

export interface LifecycleTransitionEvent {
  readonly moduleId: ModuleId;
  readonly moduleName: string;
  readonly from: LifecycleState;
  readonly to: LifecycleState;
  readonly timestamp: Date;
  readonly durationMs?: number;
  readonly error?: Error;
}

export type LifecycleTransitionHandler = (event: LifecycleTransitionEvent) => void;

// ─── Lifecycle Hooks ──────────────────────────────────────────────────────

/**
 * Hooks allow external code to run before/after lifecycle transitions.
 * Hooks are synchronous and must complete quickly.
 */
export interface LifecycleHook {
  readonly id: string;
  readonly phase: LifecycleHookPhase;
  readonly moduleId?: ModuleId;
  readonly priority?: number;
  execute(event: LifecycleTransitionEvent): void | Promise<void>;
}

export type LifecycleHookPhase =
  | 'before-init'
  | 'after-init'
  | 'before-start'
  | 'after-start'
  | 'before-stop'
  | 'after-stop'
  | 'before-destroy'
  | 'after-destroy'
  | 'on-error';

// ─── Lifecycle Observer ───────────────────────────────────────────────────

export interface LifecycleObserver {
  onStateChanged(event: LifecycleTransitionEvent): void;
}

// ─── Dependency Graph ─────────────────────────────────────────────────────

export interface LifecycleDependencyGraph {
  /**
   * Compute topological sort — startup order
   */
  getStartupOrder(moduleIds: ModuleId[]): RuntimeResult<ModuleId[]>;

  /**
   * Reverse topological sort — shutdown order
   */
  getShutdownOrder(moduleIds: ModuleId[]): RuntimeResult<ModuleId[]>;

  /**
   * Detect circular dependencies
   */
  detectCycles(): ModuleId[][];

  /**
   * Get all transitive dependencies of a module
   */
  getDependencies(moduleId: ModuleId): ModuleId[];

  /**
   * Get all modules that depend on a given module
   */
  getDependents(moduleId: ModuleId): ModuleId[];
}
