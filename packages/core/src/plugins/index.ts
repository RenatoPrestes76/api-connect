/**
 * @seltriva/core/plugins
 * Plugin system interfaces — extensibility via Plugin Pattern
 */

/**
 * Core plugin contract
 */
export interface Plugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  isActive(): boolean;
  getMetadata(): PluginMetadata;
  getConfigSchema?(): Record<string, unknown>;
  validateConfig?(config: Record<string, unknown>): Promise<boolean>;
}

/**
 * Runtime context injected into a plugin during initialization
 */
export interface PluginContext {
  /** DI container — use to resolve services (typed as unknown to avoid circular deps) */
  container: unknown;
  eventBus: unknown;
  commandBus: unknown;
  logger: unknown;
  config: Record<string, unknown>;
  pluginManager: PluginManager;
}

/**
 * Immutable plugin metadata
 */
export interface PluginMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  readonly capabilities: string[];
  readonly dependencies?: string[];
  readonly requiredInterfaces?: string[];
}

/**
 * Manages the full plugin lifecycle
 */
export interface PluginManager {
  register(plugin: Plugin): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  loadFromDirectory(path: string): Promise<void>;
  getPlugin(id: string): Plugin | null;
  getPlugins(): Plugin[];
  getPluginsByCapability(capability: string): Plugin[];
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  isEnabled(pluginId: string): boolean;
  getConfig(pluginId: string): Record<string, unknown> | null;
  updateConfig(pluginId: string, config: Record<string, unknown>): Promise<void>;
  initializeAll(): Promise<void>;
  shutdownAll(): Promise<void>;
  getDependencyTree(): PluginDependencyTree;
  areDependenciesSatisfied(pluginId: string): boolean;
}

/**
 * Dependency graph node for a single plugin
 */
export interface PluginDependencyTree {
  readonly pluginId: string;
  readonly dependencies: string[];
  readonly dependents: string[];
}

/**
 * Dynamically loads plugin modules from the filesystem or a registry
 */
export interface PluginLoader {
  load(path: string): Promise<Plugin>;
  unload(plugin: Plugin): Promise<void>;
  isValidPlugin(path: string): Promise<boolean>;
  getPluginInfo(path: string): Promise<PluginMetadata>;
}

/**
 * Extension point registered by a plugin
 */
export interface PluginHook {
  readonly name: string;
  readonly pluginId: string;
  readonly callback: (context: Record<string, unknown>) => Promise<unknown>;
  readonly priority?: number;
}

/**
 * Manages hooks across all active plugins
 */
export interface PluginHookSystem {
  registerHook(hook: PluginHook): void;
  unregisterHook(name: string, pluginId: string): void;
  executeHooks(name: string, context: Record<string, unknown>): Promise<unknown[]>;
  getHooks(name: string): PluginHook[];
}

/**
 * Plugin lifecycle event types
 */
export type PluginLifecycleEvent =
  | 'plugin:before-initialize'
  | 'plugin:after-initialize'
  | 'plugin:before-activate'
  | 'plugin:after-activate'
  | 'plugin:before-deactivate'
  | 'plugin:after-deactivate'
  | 'plugin:before-unload'
  | 'plugin:after-unload';

/**
 * Observer for plugin lifecycle transitions
 */
export interface PluginLifecycleObserver {
  onLifecycleEvent(event: PluginLifecycleEvent, plugin: Plugin): Promise<void>;
}
