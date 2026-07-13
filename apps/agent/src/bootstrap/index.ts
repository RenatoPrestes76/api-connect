/**
 * @seltriva/agent — bootstrap
 * Agent startup sequence (7 phases).
 *
 * Bootstrap sequence:
 *
 *   Phase 1: CONFIGURATION
 *     Load YAML config, validate with Zod schema,
 *     resolve credentials from CredentialStore.
 *
 *   Phase 2: SECURITY
 *     Initialize EncryptionProvider, TLSManager, CredentialStore.
 *     Validate TLS certificates for cloud endpoint.
 *
 *   Phase 3: SERVICES
 *     Open SQLite cache, initialize telemetry, log manager,
 *     build service registry, register core services.
 *
 *   Phase 4: CONNECTORS
 *     Open connection pools for all configured database connectors.
 *     Skip connectors that fail (log warning; don't abort startup).
 *
 *   Phase 5: SCHEDULER
 *     Register built-in jobs (heartbeat, health, sync, rotation).
 *     Start the scheduler clock.
 *
 *   Phase 6: PLUGINS
 *     Discover and load plugins from configured directories.
 *
 *   Phase 7: READY
 *     Run preflight diagnostics.
 *     Register with platform if first startup.
 *     Start background services (heartbeat, queue flusher).
 *     Emit agent.ready event.
 */

import type { AgentResult, AgentId, AgentConfig } from '../configuration/index';
import type { AgentContext, Disposable } from '../runtime/index';

// ─── Agent Builder ────────────────────────────────────────────────────────

export interface AgentBuilder {
  /**
   * Set the path to the YAML configuration file
   */
  withConfigPath(filePath: string): this;

  /**
   * Override the agent data directory
   */
  withDataDir(dirPath: string): this;

  /**
   * Disable a specific bootstrap phase (for testing)
   */
  skipPhase(phase: AgentBootstrapPhase): this;

  /**
   * Register a hook before a phase starts
   */
  beforePhase(phase: AgentBootstrapPhase, hook: AgentBootstrapHook): this;

  /**
   * Register a hook after a phase completes
   */
  afterPhase(phase: AgentBootstrapPhase, hook: AgentBootstrapHook): this;

  /**
   * Set an observer for bootstrap progress (used by CLI spinner)
   */
  withObserver(observer: AgentBootstrapObserver): this;

  /**
   * Execute the bootstrap sequence
   */
  build(): Promise<AgentResult<AgentInstance>>;
}

// ─── Agent Instance ───────────────────────────────────────────────────────

/**
 * The running agent — returned after successful bootstrap.
 */
export interface AgentInstance {
  readonly context: AgentContext;
  readonly config: AgentConfig;

  /**
   * True when the agent is fully operational
   */
  readonly isReady: boolean;

  /**
   * True when the agent is shutting down
   */
  readonly isShuttingDown: boolean;

  /**
   * Milliseconds since agent became ready
   */
  readonly uptimeMs: number;

  /**
   * Total bootstrap duration
   */
  readonly bootstrapDurationMs: number;

  /**
   * Gracefully shut down the agent
   */
  shutdown(reason?: string): Promise<void>;

  /**
   * Register a shutdown listener
   */
  onShutdown(handler: () => void | Promise<void>): Disposable;
}

// ─── Bootstrap Phases ─────────────────────────────────────────────────────

export type AgentBootstrapPhase =
  | 'configuration'
  | 'security'
  | 'services'
  | 'connectors'
  | 'scheduler'
  | 'plugins'
  | 'ready';

export const AGENT_BOOTSTRAP_PHASE_ORDER: AgentBootstrapPhase[] = [
  'configuration',
  'security',
  'services',
  'connectors',
  'scheduler',
  'plugins',
  'ready',
];

// ─── Bootstrap Result ─────────────────────────────────────────────────────

export interface AgentBootstrapResult {
  readonly success: boolean;
  readonly agent?: AgentInstance;
  readonly phaseResults: AgentPhaseResult[];
  readonly totalDurationMs: number;
  readonly failedPhase?: AgentBootstrapPhase;
  readonly error?: Error;
}

export interface AgentPhaseResult {
  readonly phase: AgentBootstrapPhase;
  readonly success: boolean;
  readonly durationMs: number;
  readonly warnings: string[];
  readonly error?: string;
}

// ─── Bootstrap Hook ───────────────────────────────────────────────────────

export type AgentBootstrapHook = (
  phase: AgentBootstrapPhase,
  context: Partial<AgentContext>
) => void | Promise<void>;

// ─── Bootstrap Observer ───────────────────────────────────────────────────

export interface AgentBootstrapObserver {
  onPhaseStarted(phase: AgentBootstrapPhase): void;
  onPhaseCompleted(result: AgentPhaseResult): void;
  onPhaseFailed(phase: AgentBootstrapPhase, error: Error): void;
  onBootstrapCompleted(result: AgentBootstrapResult): void;
}

// ─── Bootstrap Task IDs ───────────────────────────────────────────────────

export const AGENT_BOOTSTRAP_TASK_IDS = {
  // Configuration
  FIND_CONFIG_FILE: 'abt-find-config',
  LOAD_CONFIG: 'abt-load-config',
  VALIDATE_CONFIG: 'abt-validate-config',
  RESOLVE_ENV_OVERRIDES: 'abt-resolve-env-overrides',

  // Security
  INIT_ENCRYPTION: 'abt-init-encryption',
  INIT_CREDENTIAL_STORE: 'abt-init-credential-store',
  INIT_TLS_MANAGER: 'abt-init-tls-manager',
  VALIDATE_CLOUD_CERT: 'abt-validate-cloud-cert',
  INIT_TOKEN_MANAGER: 'abt-init-token-manager',

  // Services
  INIT_CACHE: 'abt-init-cache',
  INIT_TELEMETRY: 'abt-init-telemetry',
  INIT_LOG_MANAGER: 'abt-init-log-manager',
  INIT_SERVICE_REGISTRY: 'abt-init-service-registry',
  INIT_HEALTH_MONITOR: 'abt-init-health-monitor',

  // Connectors
  INIT_CONNECTOR_MANAGER: 'abt-init-connector-manager',
  CONNECT_ALL_DATABASES: 'abt-connect-databases',

  // Scheduler
  INIT_SCHEDULER: 'abt-init-scheduler',
  REGISTER_BUILT_IN_JOBS: 'abt-register-jobs',
  START_SCHEDULER: 'abt-start-scheduler',

  // Plugins
  DISCOVER_PLUGINS: 'abt-discover-plugins',
  LOAD_PLUGINS: 'abt-load-plugins',
  START_PLUGINS: 'abt-start-plugins',

  // Ready
  RUN_PREFLIGHT: 'abt-run-preflight',
  REGISTER_AGENT: 'abt-register-agent',
  START_HEARTBEAT: 'abt-start-heartbeat',
  START_QUEUE_FLUSHER: 'abt-start-queue-flusher',
  EMIT_READY_EVENT: 'abt-emit-ready',
} as const;

// ─── Factory ──────────────────────────────────────────────────────────────

export interface AgentBuilderFactory {
  create(): AgentBuilder;
}

export const AGENT_ID_ENV_VAR = 'SELTRIVA_AGENT_ID' as const;
export const AGENT_TOKEN_ENV_VAR = 'SELTRIVA_AGENT_TOKEN' as const;
export const AGENT_DATA_DIR_ENV_VAR = 'SELTRIVA_AGENT_DATA_DIR' as const;
