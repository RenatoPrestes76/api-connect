/**
 * @seltriva/agent — plugins
 * Plugin system for extending agent capabilities.
 *
 * Plugins can:
 *   - Add custom database connector types
 *   - Add custom sync strategies
 *   - Add custom health checks
 *   - Add custom telemetry exporters
 *   - Add custom CLI commands
 *   - Hook into sync events
 *
 * Plugins cannot:
 *   - Access credentials directly (they receive resolved connections)
 *   - Modify the agent configuration
 *   - Bypass TLS or security policies
 *   - Execute arbitrary system commands without the spawn capability
 */

import type { AgentResult, PluginId } from '../configuration/index';
import type { DatabaseConnector } from '../connectors/index';
import type { AgentLogger } from '../telemetry/index';

// ─── Plugin Manager ───────────────────────────────────────────────────────

export interface AgentPluginManager {
  /**
   * Load a plugin from a directory or file path
   */
  load(pluginPath: string): Promise<AgentResult<PluginDescriptor>>;

  /**
   * Unload a plugin
   */
  unload(pluginId: PluginId): Promise<AgentResult<void>>;

  /**
   * Reload a plugin (hot-reload during development)
   */
  reload(pluginId: PluginId): Promise<AgentResult<void>>;

  /**
   * Get a loaded plugin
   */
  get(pluginId: PluginId): PluginDescriptor | null;

  /**
   * List all loaded plugins
   */
  list(): PluginDescriptor[];

  /**
   * Load all plugins from configured directories
   */
  loadAll(directories: string[]): Promise<AgentResult<void>>;

  /**
   * Send an event to all interested plugins
   */
  dispatch(event: PluginEvent): Promise<void>;
}

// ─── Plugin Interface ─────────────────────────────────────────────────────

export interface AgentPlugin {
  readonly manifest: PluginManifest;

  /**
   * Called once when the plugin is loaded. Set up subscriptions here.
   */
  init(context: PluginContext): Promise<AgentResult<void>>;

  /**
   * Called when the plugin is started
   */
  start(): Promise<AgentResult<void>>;

  /**
   * Called before the plugin is unloaded
   */
  stop(): Promise<AgentResult<void>>;

  /**
   * Called for final cleanup
   */
  destroy(): Promise<AgentResult<void>>;
}

// ─── Plugin Manifest ──────────────────────────────────────────────────────

export interface PluginManifest {
  readonly id: PluginId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly license: string;
  readonly agentVersionRange: string;
  readonly capabilities: PluginCapability[];
  readonly subscribesToEvents?: string[];
  readonly providesConnectorTypes?: string[];
  readonly providesSyncStrategies?: string[];
  readonly providesHealthChecks?: string[];
  readonly providesTelemetryExporters?: string[];
  readonly providesCLICommands?: string[];
}

export type PluginCapability =
  | 'connector'
  | 'sync-strategy'
  | 'health-check'
  | 'telemetry-exporter'
  | 'cli-command'
  | 'event-hook'
  | 'spawn-process';

// ─── Plugin Context ───────────────────────────────────────────────────────

/**
 * Injected into each plugin — the only way plugins interact with the agent.
 */
export interface PluginContext {
  readonly pluginId: PluginId;
  readonly logger: AgentLogger;

  /**
   * Get a resolved database connection (no credentials exposed)
   */
  getConnector(connectorId: string): DatabaseConnector;

  /**
   * Subscribe to agent events
   */
  subscribe(eventKind: string, handler: PluginEventHandler): PluginEventSubscription;

  /**
   * Emit an event to the agent event bus
   */
  emit(event: PluginEvent): void;

  /**
   * Get a configuration value (read-only)
   */
  getConfig<T>(key: string): T | undefined;

  /**
   * Get the plugin's private storage directory
   */
  getStorageDir(): string;
}

// ─── Plugin Events ────────────────────────────────────────────────────────

export interface PluginEvent {
  readonly kind: string;
  readonly sourcePluginId?: PluginId;
  readonly payload?: Record<string, unknown>;
  readonly timestamp: Date;
}

export type PluginEventHandler = (event: PluginEvent) => void | Promise<void>;

export interface PluginEventSubscription {
  unsubscribe(): void;
}

// ─── Plugin Descriptor ────────────────────────────────────────────────────

export interface PluginDescriptor {
  readonly manifest: PluginManifest;
  readonly pluginPath: string;
  readonly state: PluginState;
  readonly loadedAt: Date;
  readonly error?: string;
}

export type PluginState =
  | 'loading'
  | 'loaded'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'unloaded';

// ─── Plugin Validator ─────────────────────────────────────────────────────

export interface PluginValidator {
  validate(manifest: PluginManifest, agentVersion: string): PluginValidationResult;
}

export interface PluginValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}
