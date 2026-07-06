/**
 * @seltriva/runtime/plugin-manager
 * Plugin Manager — safe loading, isolation, and lifecycle of plugins
 *
 * Plugins extend the platform without modifying core code.
 * Every plugin:
 *   - Declares its capabilities and dependencies in a manifest
 *   - Runs inside a sandbox with a declared capability set
 *   - Follows the standard module lifecycle (init/start/stop/destroy)
 *   - Is versioned and can be hot-reloaded
 *
 * Plugin discovery strategies:
 *   - Directory scan (local plugins)
 *   - Registry manifest (remote/NPM plugins)
 *   - Dynamic registration (programmatic)
 */

import type {
  RuntimeResult, PluginId, ModuleId, Disposable,
} from '../kernel/index';
import type { LifecycleState } from '../lifecycle/index';
import type { SandboxLevel, SandboxCapability, ResourceQuota } from '../sandbox/index';

// ─── Plugin Manager ───────────────────────────────────────────────────────

export interface PluginManager {
  /**
   * Load and register a plugin from its manifest
   */
  load(manifest: PluginManifest): Promise<RuntimeResult<PluginRegistration>>;

  /**
   * Load all plugins from a directory
   */
  loadFromDirectory(dirPath: string): Promise<RuntimeResult<PluginRegistration[]>>;

  /**
   * Unload and destroy a plugin
   */
  unload(pluginId: PluginId, reason?: string): Promise<RuntimeResult<void>>;

  /**
   * Enable a disabled plugin
   */
  enable(pluginId: PluginId): Promise<RuntimeResult<void>>;

  /**
   * Disable a plugin (stops it but keeps it registered)
   */
  disable(pluginId: PluginId, reason?: string): Promise<RuntimeResult<void>>;

  /**
   * Reload a plugin in-place (unload + load with same manifest)
   */
  reload(pluginId: PluginId): Promise<RuntimeResult<PluginRegistration>>;

  /**
   * Get a plugin registration
   */
  get(pluginId: PluginId): PluginRegistration | null;

  /**
   * Get all registered plugins
   */
  getAll(): PluginRegistration[];

  /**
   * Get plugins by state
   */
  getByState(state: PluginState): PluginRegistration[];

  /**
   * Check whether a plugin is loaded and running
   */
  isRunning(pluginId: PluginId): boolean;

  /**
   * Subscribe to plugin lifecycle events
   */
  onPluginEvent(handler: PluginEventHandler): Disposable;

  /**
   * Get plugin manager statistics
   */
  getStats(): PluginManagerStats;
}

// ─── Plugin Manifest ──────────────────────────────────────────────────────

/**
 * The static declaration of a plugin — source of truth for capabilities,
 * dependencies, and metadata.
 */
export interface PluginManifest {
  readonly id: PluginId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author?: string;
  readonly license?: string;

  /** JavaScript/TypeScript entry point */
  readonly entryPoint: string;

  /** Sandbox isolation level */
  readonly sandboxLevel: SandboxLevel;

  /** Capabilities the plugin needs */
  readonly requiredCapabilities: SandboxCapability[];
  readonly optionalCapabilities?: SandboxCapability[];

  /** Resource limits (override defaults) */
  readonly quotas?: Partial<ResourceQuota>;

  /** Other plugins this one depends on */
  readonly pluginDependencies?: PluginDependency[];

  /** Platform modules this plugin depends on */
  readonly moduleDependencies?: ModuleId[];

  /** Services this plugin provides */
  readonly providesServices?: string[];

  /** Services this plugin consumes */
  readonly consumesServices?: string[];

  /** Events this plugin publishes */
  readonly publishesTopics?: string[];

  /** Events this plugin subscribes to */
  readonly subscribesTopics?: string[];

  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface PluginDependency {
  readonly pluginId: PluginId;
  readonly versionRange: string;
  readonly optional?: boolean;
}

// ─── Plugin Registration ──────────────────────────────────────────────────

export interface PluginRegistration {
  readonly pluginId: PluginId;
  readonly manifest: PluginManifest;
  readonly state: PluginState;
  readonly sandboxId: string;
  readonly loadedAt: Date;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
  readonly errorCount: number;
  readonly lastError?: string;
}

// ─── Plugin State ─────────────────────────────────────────────────────────

export type PluginState =
  | 'registered'
  | 'loading'
  | 'loaded'
  | 'starting'
  | 'running'
  | 'disabled'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'unloaded';

// ─── Plugin Interface ─────────────────────────────────────────────────────

/**
 * The interface every plugin entry point must implement.
 */
export interface Plugin {
  readonly manifest: PluginManifest;

  init(context: PluginContext): Promise<RuntimeResult<void>>;
  start(): Promise<RuntimeResult<void>>;
  stop(): Promise<RuntimeResult<void>>;
  destroy(): Promise<RuntimeResult<void>>;
}

// ─── Plugin Context ───────────────────────────────────────────────────────

/**
 * Injected into each plugin during init().
 * Provides only the services the sandbox grants.
 */
export interface PluginContext {
  readonly pluginId: PluginId;
  readonly sandboxLevel: SandboxLevel;

  /**
   * Resolve a service the plugin has access to
   */
  resolveService<T>(token: string | symbol): T;

  /**
   * Emit an event (requires 'publish-events' capability)
   */
  publishEvent(topic: string, payload: Record<string, unknown>): Promise<void>;

  /**
   * Subscribe to events (requires 'subscribe-events' capability)
   */
  subscribeEvent(pattern: string, handler: (event: Record<string, unknown>) => Promise<void>): Disposable;

  /**
   * Get a configuration value (requires 'read-config' capability)
   */
  getConfig<T>(key: string): T | undefined;

  /**
   * Get a plugin-specific logger
   */
  getLogger(): { info: (msg: string, ctx?: object) => void; error: (msg: string, ctx?: object) => void };
}

// ─── Plugin Events ────────────────────────────────────────────────────────

export type PluginEventKind = 'loaded' | 'started' | 'stopped' | 'disabled' | 'error' | 'unloaded' | 'reloaded';

export interface PluginEvent {
  readonly kind: PluginEventKind;
  readonly pluginId: PluginId;
  readonly state: PluginState;
  readonly timestamp: Date;
  readonly error?: string;
}

export type PluginEventHandler = (event: PluginEvent) => void;

// ─── Plugin Validator ─────────────────────────────────────────────────────

export interface PluginValidator {
  validateManifest(manifest: PluginManifest): PluginValidationResult;
  checkConflicts(manifest: PluginManifest, existing: PluginRegistration[]): PluginConflict[];
  checkCapabilities(manifest: PluginManifest): PluginCapabilityCheck;
}

export interface PluginValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export interface PluginConflict {
  readonly conflictingPluginId: PluginId;
  readonly kind: 'version' | 'service-conflict' | 'event-conflict' | 'duplicate-id';
  readonly description: string;
  readonly isBlocking: boolean;
}

export interface PluginCapabilityCheck {
  readonly requiredCapabilities: Array<{ capability: SandboxCapability; granted: boolean }>;
  readonly allGranted: boolean;
  readonly denied: SandboxCapability[];
}

// ─── Stats ────────────────────────────────────────────────────────────────

export interface PluginManagerStats {
  readonly totalRegistered: number;
  readonly running: number;
  readonly disabled: number;
  readonly errored: number;
  readonly totalLoaded: number;
  readonly totalUnloaded: number;
  readonly totalErrors: number;
}
