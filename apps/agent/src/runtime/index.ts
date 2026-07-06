/**
 * @seltriva/agent — runtime
 * Agent process runtime: signal handling, graceful shutdown, restart coordination.
 *
 * The runtime wraps the Node.js process lifecycle:
 *   - Registers SIGTERM / SIGINT handlers for graceful shutdown
 *   - Manages the PID file for daemon coordination
 *   - Provides a process exit hook registry
 *   - Exposes process health metrics (uptime, memory, CPU)
 */

import type { AgentResult, AgentId } from '../configuration/index';

// ─── Agent Runtime ────────────────────────────────────────────────────────

export interface AgentRuntime {
  /**
   * The unique ID of this agent instance
   */
  readonly agentId: AgentId;

  /**
   * The agent version string
   */
  readonly version: string;

  /**
   * True while the agent is shutting down
   */
  readonly isShuttingDown: boolean;

  /**
   * Register a shutdown hook (runs before process exit)
   */
  onShutdown(hook: ShutdownHook, priority?: number): void;

  /**
   * Register an unhandled rejection handler
   */
  onUnhandledRejection(handler: UnhandledRejectionHandler): void;

  /**
   * Register an uncaught exception handler
   */
  onUncaughtException(handler: UncaughtExceptionHandler): void;

  /**
   * Initiate a graceful shutdown
   */
  shutdown(reason?: string, exitCode?: number): Promise<void>;

  /**
   * Restart the agent process (exec-based)
   */
  restart(reason?: string): Promise<void>;

  /**
   * Get process metrics
   */
  getProcessMetrics(): ProcessRuntimeMetrics;
}

export type ShutdownHook = (reason?: string) => void | Promise<void>;
export type UnhandledRejectionHandler = (reason: unknown, promise: Promise<unknown>) => void;
export type UncaughtExceptionHandler = (error: Error) => void;

export interface ProcessRuntimeMetrics {
  readonly pid: number;
  readonly uptimeMs: number;
  readonly memoryUsage: NodeJS.MemoryUsage;
  readonly cpuUsage: NodeJS.CpuUsage;
  readonly version: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
}

// ─── PID File Manager ─────────────────────────────────────────────────────

export interface PidFileManager {
  /**
   * Write PID file to the agent data directory
   */
  write(dataDir: string): AgentResult<void>;

  /**
   * Remove PID file on shutdown
   */
  remove(dataDir: string): AgentResult<void>;

  /**
   * Read PID from file (for CLI daemon commands)
   */
  read(dataDir: string): number | null;

  /**
   * Check if a running process has the PID from file
   */
  isRunning(dataDir: string): boolean;
}

// ─── Signal Handler ───────────────────────────────────────────────────────

export interface SignalHandler {
  /**
   * Register OS signal handlers for graceful shutdown
   */
  register(runtime: AgentRuntime): void;

  /**
   * Unregister all signal handlers
   */
  unregister(): void;
}

// ─── Agent Context ────────────────────────────────────────────────────────

export interface AgentContext {
  readonly agentId: AgentId;
  readonly version: string;
  readonly environment: string;
  readonly hostname: string;
  readonly dataDir: string;
  readonly configPath: string;
  readonly startedAt: Date;
}

// ─── Disposable ───────────────────────────────────────────────────────────

export interface Disposable {
  dispose(): void;
}
