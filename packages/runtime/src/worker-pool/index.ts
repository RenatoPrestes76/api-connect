/**
 * @seltriva/runtime/worker-pool
 * Worker Pool — concurrent task execution with backpressure and observability
 *
 * The worker pool manages a set of workers that execute tasks concurrently.
 * Features:
 *   - Fixed and dynamic pool sizes
 *   - Priority queuing (critical → high → normal → low → background)
 *   - Backpressure (reject when queue is full)
 *   - Worker health monitoring
 *   - Task timeout and cancellation
 *   - Graceful drain on shutdown
 */

import type {
  RuntimeResult, WorkerId, WorkerPoolId, ModuleId,
  Priority, Disposable,
} from '../kernel/index';

// ─── Worker Pool Manager ──────────────────────────────────────────────────

export interface WorkerPoolManager {
  /**
   * Create a new worker pool
   */
  createPool(config: WorkerPoolConfig): RuntimeResult<WorkerPool>;

  /**
   * Get a pool by ID
   */
  getPool(poolId: WorkerPoolId): WorkerPool | null;

  /**
   * Get the default shared pool
   */
  getDefaultPool(): WorkerPool;

  /**
   * Get all pools
   */
  getAllPools(): WorkerPool[];

  /**
   * Destroy a pool and wait for all tasks to drain
   */
  destroyPool(poolId: WorkerPoolId, drainTimeoutMs?: number): Promise<RuntimeResult<void>>;

  /**
   * Get aggregate stats across all pools
   */
  getStats(): WorkerPoolManagerStats;
}

// ─── Worker Pool ──────────────────────────────────────────────────────────

export interface WorkerPool {
  readonly id: WorkerPoolId;
  readonly config: WorkerPoolConfig;
  readonly stats: WorkerPoolStats;

  /**
   * Submit a task to the pool
   */
  submit<T>(task: PooledTask<T>): Promise<RuntimeResult<T>>;

  /**
   * Submit multiple tasks, returns results in order
   */
  submitBatch<T>(tasks: PooledTask<T>[]): Promise<RuntimeResult<T>[]>;

  /**
   * Submit a task to a specific worker (for affinity)
   */
  submitTo<T>(workerId: WorkerId, task: PooledTask<T>): Promise<RuntimeResult<T>>;

  /**
   * Get a specific worker
   */
  getWorker(workerId: WorkerId): PooledWorker | null;

  /**
   * Get all workers
   */
  getWorkers(): PooledWorker[];

  /**
   * Resize the pool (add or remove workers)
   */
  resize(newSize: number): Promise<RuntimeResult<void>>;

  /**
   * Pause the pool (queues tasks but does not execute them)
   */
  pause(): void;

  /**
   * Resume a paused pool
   */
  resume(): void;

  /**
   * Drain the queue (wait for all tasks to complete)
   */
  drain(timeoutMs?: number): Promise<RuntimeResult<void>>;

  /**
   * Subscribe to pool events
   */
  onEvent(handler: WorkerPoolEventHandler): Disposable;
}

// ─── Worker Pool Config ───────────────────────────────────────────────────

export interface WorkerPoolConfig {
  readonly id: WorkerPoolId;
  readonly name: string;
  readonly ownerModuleId?: ModuleId;

  readonly minWorkers: number;
  readonly maxWorkers: number;

  readonly queueCapacity?: number;
  readonly taskTimeoutMs?: number;
  readonly workerIdleTimeoutMs?: number;

  readonly workerFactory?: WorkerFactory;

  /** Priority queue weights */
  readonly priorityWeights?: PriorityWeights;
}

export interface PriorityWeights {
  readonly critical: number;
  readonly high: number;
  readonly normal: number;
  readonly low: number;
  readonly background: number;
}

// ─── Pooled Worker ────────────────────────────────────────────────────────

export interface PooledWorker {
  readonly id: WorkerId;
  readonly poolId: WorkerPoolId;
  readonly status: WorkerStatus;
  readonly currentTask?: string;
  readonly taskCount: number;
  readonly errorCount: number;
  readonly spawnedAt: Date;
  readonly lastActiveAt?: Date;
}

export type WorkerStatus = 'idle' | 'busy' | 'draining' | 'error' | 'terminated';

// ─── Pooled Task ──────────────────────────────────────────────────────────

export interface PooledTask<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly priority: Priority;
  readonly fn: WorkerTaskFn<T>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly metadata?: Record<string, unknown>;
}

export type WorkerTaskFn<T> = (signal: AbortSignal) => Promise<T>;

// ─── Worker Factory ───────────────────────────────────────────────────────

export interface WorkerFactory {
  create(workerId: WorkerId, poolId: WorkerPoolId): PooledWorker;
  destroy(worker: PooledWorker): Promise<void>;
}

// ─── Stats ────────────────────────────────────────────────────────────────

export interface WorkerPoolStats {
  readonly poolId: WorkerPoolId;
  readonly workerCount: number;
  readonly idleWorkers: number;
  readonly busyWorkers: number;
  readonly queueDepth: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly timedOutTasks: number;
  readonly averageTaskDurationMs: number;
  readonly throughputPerSecond: number;
  readonly isPaused: boolean;
}

export interface WorkerPoolManagerStats {
  readonly totalPools: number;
  readonly totalWorkers: number;
  readonly totalQueueDepth: number;
  readonly totalRunningTasks: number;
  readonly pools: WorkerPoolStats[];
}

// ─── Events ───────────────────────────────────────────────────────────────

export type WorkerPoolEventKind =
  | 'worker-spawned'
  | 'worker-terminated'
  | 'worker-error'
  | 'task-submitted'
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'task-timed-out'
  | 'task-cancelled'
  | 'queue-full'
  | 'pool-paused'
  | 'pool-resumed'
  | 'pool-drained';

export interface WorkerPoolEvent {
  readonly kind: WorkerPoolEventKind;
  readonly poolId: WorkerPoolId;
  readonly workerId?: WorkerId;
  readonly taskId?: string;
  readonly taskName?: string;
  readonly error?: string;
  readonly timestamp: Date;
}

export type WorkerPoolEventHandler = (event: WorkerPoolEvent) => void;
