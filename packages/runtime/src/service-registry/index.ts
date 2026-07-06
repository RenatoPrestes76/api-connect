/**
 * @seltriva/runtime/service-registry
 * Service Registry — dependency injection container and service locator
 *
 * The service registry is the platform's DI container.
 * All modules register their services here; all modules resolve their
 * dependencies from here.
 *
 * Scopes:
 *   Singleton   — one instance per platform lifetime
 *   Transient   — new instance per resolution
 *   Scoped      — one instance per module scope
 *
 * Tokens are string or symbol identifiers that decouple
 * service consumers from concrete implementations.
 */

import type {
  RuntimeResult, ServiceId, ModuleId, Token, Disposable,
} from '../kernel/index';

// ─── Service Registry ─────────────────────────────────────────────────────

export interface ServiceRegistry {
  /**
   * Register a singleton service
   */
  registerSingleton<T>(token: Token<T>, factory: ServiceFactory<T>, descriptor?: Partial<ServiceDescriptor>): void;

  /**
   * Register a transient service (new instance each resolution)
   */
  registerTransient<T>(token: Token<T>, factory: ServiceFactory<T>, descriptor?: Partial<ServiceDescriptor>): void;

  /**
   * Register a scoped service (one instance per module scope)
   */
  registerScoped<T>(token: Token<T>, factory: ServiceFactory<T>, descriptor?: Partial<ServiceDescriptor>): void;

  /**
   * Register an already-constructed instance as a singleton
   */
  registerInstance<T>(token: Token<T>, instance: T, descriptor?: Partial<ServiceDescriptor>): void;

  /**
   * Resolve a required service
   */
  resolve<T>(token: Token<T>): T;

  /**
   * Try to resolve a service — returns undefined if not registered
   */
  tryResolve<T>(token: Token<T>): T | undefined;

  /**
   * Resolve all implementations registered for a token (multi-binding)
   */
  resolveAll<T>(token: Token<T>): T[];

  /**
   * Check if a token is registered
   */
  isRegistered<T>(token: Token<T>): boolean;

  /**
   * Create a child scope for a module
   */
  createScope(moduleId: ModuleId): ServiceScope;

  /**
   * Get all service descriptors
   */
  getDescriptors(): ServiceDescriptor[];

  /**
   * Get the descriptor for a specific token
   */
  getDescriptor<T>(token: Token<T>): ServiceDescriptor | null;

  /**
   * Listen for service registrations
   */
  onRegistered(handler: (descriptor: ServiceDescriptor) => void): Disposable;
}

// ─── Service Scope ────────────────────────────────────────────────────────

export interface ServiceScope extends ServiceRegistry, Disposable {
  readonly moduleId: ModuleId;
  readonly parentRegistry: ServiceRegistry;
}

// ─── Service Descriptor ───────────────────────────────────────────────────

export interface ServiceDescriptor {
  readonly serviceId: ServiceId;
  readonly token: Token;
  readonly scope: ServiceLifetime;
  readonly name: string;
  readonly description?: string;
  readonly providedBy: ModuleId;
  readonly tags?: string[];
  readonly isRequired: boolean;
  readonly registeredAt: Date;
}

export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

// ─── Factory ──────────────────────────────────────────────────────────────

export type ServiceFactory<T> = (container: ServiceRegistry) => T;

// ─── Service Tokens ───────────────────────────────────────────────────────

export const SERVICE_TOKENS = {
  // Core
  PLATFORM_KERNEL:         Symbol('PlatformKernel')         as Token,
  LIFECYCLE_MANAGER:       Symbol('LifecycleManager')       as Token,
  CONFIGURATION_PROVIDER:  Symbol('ConfigurationProvider')  as Token,
  SECRET_PROVIDER:         Symbol('SecretProvider')         as Token,
  FEATURE_FLAGS:           Symbol('FeatureFlagProvider')    as Token,

  // Communication
  EVENT_BUS:               Symbol('EventBus')               as Token,
  COMMAND_BUS:             Symbol('CommandBus')             as Token,

  // Execution
  SCHEDULER:               Symbol('Scheduler')              as Token,
  WORKER_POOL_MANAGER:     Symbol('WorkerPoolManager')      as Token,

  // Observability
  TELEMETRY_PROVIDER:      Symbol('TelemetryProvider')      as Token,
  LOGGER:                  Symbol('RuntimeLogger')          as Token,
  TRACER:                  Symbol('RuntimeTracer')          as Token,
  METER:                   Symbol('RuntimeMeter')           as Token,

  // Health & Diagnostics
  HEALTH_MONITOR:          Symbol('HealthMonitor')          as Token,
  DIAGNOSTICS_PROVIDER:    Symbol('DiagnosticsProvider')   as Token,

  // Security
  PERMISSION_MODEL:        Symbol('PermissionModel')        as Token,
  SANDBOX_MANAGER:         Symbol('SandboxManager')         as Token,

  // Resilience
  RESILIENCE_FACTORY:      Symbol('ResilienceFactory')      as Token,

  // Plugins
  PLUGIN_MANAGER:          Symbol('PluginManager')          as Token,
  MODULE_LOADER:           Symbol('ModuleLoader')           as Token,

  // Orchestration
  ORCHESTRATOR:            Symbol('Orchestrator')           as Token,

  // Data
  DATABASE_CLIENT:         Symbol('DatabaseClient')         as Token,
  SUPABASE_CLIENT:         Symbol('SupabaseClient')         as Token,
  CACHE_PROVIDER:          Symbol('CacheProvider')          as Token,
} as const;

// ─── DI Container Builder ────────────────────────────────────────────────

export interface ContainerBuilder {
  register<T>(token: Token<T>, factory: ServiceFactory<T>, lifetime: ServiceLifetime): this;
  registerInstance<T>(token: Token<T>, instance: T): this;
  addModule(configurator: ContainerModule): this;
  build(): ServiceRegistry;
}

export interface ContainerModule {
  readonly name: string;
  configure(builder: ContainerBuilder): void;
}

// ─── Service Health ───────────────────────────────────────────────────────

export interface ServiceHealthIndicator {
  readonly serviceId: ServiceId;
  checkHealth(): Promise<{ healthy: boolean; message?: string }>;
}
