/**
 * @seltriva/runtime/command-bus
 * Command Bus — request/response command dispatch with middleware
 *
 * Commands represent intent: "do this thing" with an expected result.
 * This differs from events (which announce what happened).
 *
 * Features:
 *   - Typed commands and results
 *   - Middleware pipeline (auth, validation, logging, tracing)
 *   - Handler registration with capability checks
 *   - Synchronous and async dispatch
 *   - Command logging and replay capability
 */

import type {
  RuntimeResult,
  ModuleId,
  CommandId,
  CorrelationId,
  SpanContext,
  Priority,
  Disposable,
} from '../kernel/index';

// ─── Command Bus ──────────────────────────────────────────────────────────

export interface CommandBus {
  /**
   * Dispatch a command and wait for the result
   */
  dispatch<TCommand extends Command, TResult>(
    command: TCommand,
    options?: DispatchOptions
  ): Promise<RuntimeResult<TResult>>;

  /**
   * Dispatch without waiting for a result (fire-and-forget)
   */
  send<TCommand extends Command>(command: TCommand): void;

  /**
   * Register a handler for a command type
   */
  register<TCommand extends Command, TResult>(
    commandType: string,
    handler: CommandHandler<TCommand, TResult>
  ): Disposable;

  /**
   * Unregister a handler
   */
  unregister(commandType: string): void;

  /**
   * Check if a handler is registered for a command type
   */
  hasHandler(commandType: string): boolean;

  /**
   * Add middleware to the pipeline
   */
  use(middleware: CommandMiddleware): void;

  /**
   * Get command bus statistics
   */
  getStats(): CommandBusStats;
}

// ─── Command ──────────────────────────────────────────────────────────────

export interface Command {
  readonly id: CommandId;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: CommandMetadata;
}

export interface CommandMetadata {
  readonly issuedBy: ModuleId | string;
  readonly correlationId: CorrelationId;
  readonly causationId?: CommandId;
  readonly spanContext?: SpanContext;
  readonly priority: Priority;
  readonly issuedAt: Date;
  readonly timeoutMs?: number;
  readonly retryable?: boolean;
}

// ─── Handler ──────────────────────────────────────────────────────────────

export interface CommandHandler<TCommand extends Command, TResult = void> {
  readonly handlerModuleId?: ModuleId;
  handle(command: TCommand, context: CommandHandlerContext): Promise<TResult>;
}

export interface CommandHandlerContext {
  readonly correlationId: CorrelationId;
  readonly dispatchedAt: Date;
  readonly attempt: number;
  readonly spanContext?: SpanContext;
  readonly metadata?: Record<string, unknown>;
}

// ─── Middleware ───────────────────────────────────────────────────────────

export interface CommandMiddleware {
  readonly id: string;
  readonly order: number;
  execute<T>(
    command: Command,
    next: CommandMiddlewareNext<T>,
    context: CommandHandlerContext
  ): Promise<RuntimeResult<T>>;
}

export type CommandMiddlewareNext<T> = () => Promise<RuntimeResult<T>>;

// ─── Dispatch Options ─────────────────────────────────────────────────────

export interface DispatchOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly priority?: Priority;
  readonly skipMiddleware?: boolean;
}

// ─── Built-in Command Types ───────────────────────────────────────────────

export const COMMAND_TYPES = {
  // Lifecycle
  START_MODULE: 'StartModuleCommand',
  STOP_MODULE: 'StopModuleCommand',
  RELOAD_MODULE: 'ReloadModuleCommand',

  // Configuration
  RELOAD_CONFIGURATION: 'ReloadConfigurationCommand',
  SET_FEATURE_FLAG: 'SetFeatureFlagCommand',

  // Plugins
  LOAD_PLUGIN: 'LoadPluginCommand',
  UNLOAD_PLUGIN: 'UnloadPluginCommand',
  ENABLE_PLUGIN: 'EnablePluginCommand',
  DISABLE_PLUGIN: 'DisablePluginCommand',

  // Scheduler
  SCHEDULE_JOB: 'ScheduleJobCommand',
  CANCEL_JOB: 'CancelJobCommand',
  TRIGGER_JOB: 'TriggerJobCommand',

  // Workers
  SPAWN_WORKER: 'SpawnWorkerCommand',
  TERMINATE_WORKER: 'TerminateWorkerCommand',
  RESIZE_POOL: 'ResizePoolCommand',

  // Platform
  SHUTDOWN_PLATFORM: 'ShutdownPlatformCommand',
  ROTATE_SECRET: 'RotateSecretCommand',
  FLUSH_TELEMETRY: 'FlushTelemetryCommand',
} as const;

export type BuiltInCommandType = (typeof COMMAND_TYPES)[keyof typeof COMMAND_TYPES];

// ─── Stats ────────────────────────────────────────────────────────────────

export interface CommandBusStats {
  readonly dispatchedTotal: number;
  readonly succeededTotal: number;
  readonly failedTotal: number;
  readonly timeoutTotal: number;
  readonly averageDurationMs: number;
  readonly activeHandlers: number;
  readonly byType: Record<
    string,
    { dispatched: number; succeeded: number; failed: number; avgMs: number }
  >;
}

// ─── Command Log ──────────────────────────────────────────────────────────

export interface CommandLog {
  readonly commandId: CommandId;
  readonly type: string;
  readonly issuedBy: ModuleId | string;
  readonly correlationId: CorrelationId;
  readonly success: boolean;
  readonly durationMs: number;
  readonly errorCode?: string;
  readonly issuedAt: Date;
  readonly completedAt: Date;
}

export interface CommandStore {
  append(log: CommandLog): Promise<void>;
  getById(id: CommandId): Promise<CommandLog | null>;
  queryByType(type: string, since?: Date, limit?: number): Promise<CommandLog[]>;
  queryByCorrelation(correlationId: CorrelationId): Promise<CommandLog[]>;
}
