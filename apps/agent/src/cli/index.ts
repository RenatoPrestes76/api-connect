/**
 * @seltriva/agent — cli
 * Command-line interface for the Sentinel agent.
 *
 * Commands:
 *   install    — install and register the agent with the platform
 *   configure  — interactive configuration wizard
 *   start      — start the agent daemon
 *   stop       — stop the agent daemon
 *   restart    — restart the agent daemon
 *   status     — show current agent status
 *   doctor     — run diagnostic checks
 *   logs       — view and follow agent logs
 *   update     — check and apply updates
 *   sync       — manually trigger a sync
 *   connector  — manage database connectors
 */

import type { AgentResult, ConnectorId } from '../configuration/index';

// ─── CLI Application ──────────────────────────────────────────────────────

export interface CLIApplication {
  /**
   * Register all built-in commands
   */
  register(commands: CLICommand[]): void;

  /**
   * Parse and execute a command from argv
   */
  run(argv: string[]): Promise<void>;

  /**
   * Get output context (for capturing in tests)
   */
  getOutput(): CLIOutput;
}

// ─── CLI Command ──────────────────────────────────────────────────────────

export interface CLICommand {
  readonly name: string;
  readonly description: string;
  readonly aliases?: string[];
  readonly options?: CLIOption[];
  readonly arguments?: CLIArgument[];
  readonly subcommands?: CLICommand[];
  execute(args: CLIExecutionArgs): Promise<CLICommandResult>;
}

export interface CLIOption {
  readonly flags: string;
  readonly description: string;
  readonly defaultValue?: unknown;
  readonly required?: boolean;
}

export interface CLIArgument {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

export interface CLIExecutionArgs {
  readonly args: Record<string, unknown>;
  readonly options: Record<string, unknown>;
  readonly output: CLIOutput;
  readonly config: CLIGlobalOptions;
}

export interface CLIGlobalOptions {
  readonly configPath?: string;
  readonly verbose: boolean;
  readonly json: boolean;
  readonly noColor: boolean;
}

export interface CLICommandResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly message?: string;
}

// ─── CLI Output ───────────────────────────────────────────────────────────

export interface CLIOutput {
  info(message: string, data?: Record<string, unknown>): void;
  success(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
  table(headers: string[], rows: string[][]): void;
  json(data: unknown): void;
  spinner(message: string): CLISpinner;
  prompt<T>(question: CLIPromptQuestion<T>): Promise<T>;
  separator(): void;
  blank(): void;
}

export interface CLISpinner {
  update(message: string): void;
  succeed(message?: string): void;
  fail(message?: string): void;
  stop(): void;
}

export interface CLIPromptQuestion<T> {
  readonly type: 'input' | 'password' | 'confirm' | 'select' | 'multiselect';
  readonly message: string;
  readonly choices?: Array<{ label: string; value: T }>;
  readonly defaultValue?: T;
  readonly validate?: (value: T) => string | true;
}

// ─── Command Definitions ──────────────────────────────────────────────────

export interface InstallCommandArgs {
  readonly platformUrl?: string;
  readonly agentName?: string;
  readonly configPath?: string;
  readonly nonInteractive?: boolean;
}

export interface ConfigureCommandArgs {
  readonly configPath?: string;
  readonly nonInteractive?: boolean;
  readonly connector?: boolean;
  readonly security?: boolean;
  readonly sync?: boolean;
}

export interface DaemonCommandArgs {
  readonly configPath?: string;
  readonly foreground?: boolean;
}

export interface StatusCommandOutput {
  readonly version: string;
  readonly environment: string;
  readonly status: 'running' | 'stopped' | 'unknown';
  readonly pid?: number;
  readonly uptime?: string;
  readonly lastSync?: string;
  readonly health?: string;
  readonly connectors: ConnectorStatusRow[];
}

export interface ConnectorStatusRow {
  readonly id: ConnectorId;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly lastSync?: string;
}

export interface DoctorCommandArgs {
  readonly fix?: boolean;
  readonly verbose?: boolean;
  readonly category?: string;
}

export interface LogsCommandArgs {
  readonly follow?: boolean;
  readonly lines?: number;
  readonly level?: string;
  readonly since?: string;
  readonly connector?: string;
  readonly json?: boolean;
}

export interface UpdateCommandArgs {
  readonly check?: boolean;
  readonly channel?: string;
  readonly force?: boolean;
  readonly version?: string;
}

export interface SyncCommandArgs {
  readonly connector?: string;
  readonly full?: boolean;
  readonly schema?: string;
  readonly dryRun?: boolean;
}

export interface ConnectorCommandArgs {
  readonly subcommand: 'list' | 'add' | 'remove' | 'test' | 'show';
  readonly connectorId?: string;
}

// ─── Process Management ───────────────────────────────────────────────────

export interface DaemonManager {
  /**
   * Start the agent as a background daemon
   */
  start(configPath?: string): Promise<AgentResult<DaemonInfo>>;

  /**
   * Stop the running daemon
   */
  stop(): Promise<AgentResult<void>>;

  /**
   * Restart the daemon
   */
  restart(): Promise<AgentResult<DaemonInfo>>;

  /**
   * Get current daemon status
   */
  getStatus(): AgentResult<DaemonStatus>;

  /**
   * Check if the daemon is running
   */
  isRunning(): boolean;
}

export interface DaemonInfo {
  readonly pid: number;
  readonly startedAt: Date;
  readonly configPath: string;
  readonly version: string;
}

export interface DaemonStatus {
  readonly isRunning: boolean;
  readonly pid?: number;
  readonly uptime?: number;
  readonly version?: string;
  readonly configPath?: string;
  readonly lastSyncAt?: Date;
  readonly health?: string;
}
