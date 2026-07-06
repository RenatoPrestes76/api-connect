/**
 * @seltriva/runtime/sandbox
 * Sandbox — plugin isolation and resource containment
 *
 * Every plugin runs inside a sandbox that:
 *   - Restricts filesystem access to an allowed list
 *   - Limits outbound network calls to declared hosts
 *   - Enforces memory and CPU quotas
 *   - Isolates exceptions (plugin crash cannot affect platform)
 *   - Audits all resource access
 *
 * Sandbox levels (from most to least restrictive):
 *   strict    — no FS, no network, no process spawning
 *   standard  — declared FS paths, declared network hosts
 *   trusted   — broad access (only for first-party plugins)
 *   native    — unrestricted (only for core runtime modules)
 */

import type { RuntimeResult, SandboxId, PluginId, ModuleId, Severity } from '../kernel/index';

// ─── Sandbox Manager ──────────────────────────────────────────────────────

export interface SandboxManager {
  /**
   * Create a new sandbox for a plugin
   */
  create(pluginId: PluginId, policy: SandboxPolicy): RuntimeResult<Sandbox>;

  /**
   * Get an existing sandbox
   */
  get(sandboxId: SandboxId): Sandbox | null;

  /**
   * Destroy a sandbox and release all resources
   */
  destroy(sandboxId: SandboxId): Promise<RuntimeResult<void>>;

  /**
   * Get all active sandboxes
   */
  getAll(): Sandbox[];

  /**
   * Get sandbox violations (security events)
   */
  getViolations(sandboxId?: SandboxId): SandboxViolation[];

  /**
   * Get resource usage across all sandboxes
   */
  getResourceUsage(): SandboxResourceReport;
}

// ─── Sandbox ──────────────────────────────────────────────────────────────

export interface Sandbox {
  readonly id: SandboxId;
  readonly pluginId: PluginId;
  readonly level: SandboxLevel;
  readonly policy: SandboxPolicy;
  readonly stats: SandboxStats;
  readonly createdAt: Date;
  readonly isActive: boolean;

  /**
   * Execute a function in this sandbox's context
   */
  execute<T>(fn: () => T | Promise<T>): Promise<RuntimeResult<T>>;

  /**
   * Check if a capability is granted
   */
  hasCapability(capability: SandboxCapability): boolean;

  /**
   * Assert a capability is granted — throws if not
   */
  assertCapability(capability: SandboxCapability, context?: string): void;

  /**
   * Get the violation log for this sandbox
   */
  getViolations(): SandboxViolation[];
}

// ─── Sandbox Levels ───────────────────────────────────────────────────────

export type SandboxLevel = 'strict' | 'standard' | 'trusted' | 'native';

// ─── Sandbox Policy ───────────────────────────────────────────────────────

export interface SandboxPolicy {
  readonly level: SandboxLevel;
  readonly capabilities: SandboxCapability[];
  readonly allowedFilePaths?: string[];
  readonly allowedNetworkHosts?: string[];
  readonly allowedServiceTokens?: string[];
  readonly quotas: ResourceQuota;
  readonly onViolation?: SandboxViolationAction;
}

export type SandboxViolationAction =
  | 'log'            // log and continue
  | 'warn'           // log, alert, continue
  | 'terminate';     // log, alert, destroy sandbox

// ─── Capabilities ─────────────────────────────────────────────────────────

export type SandboxCapability =
  | 'read-config'           // read configuration values
  | 'write-config'          // write configuration values
  | 'read-secret'           // access secret provider
  | 'publish-events'        // publish to event bus
  | 'subscribe-events'      // subscribe to event bus
  | 'dispatch-commands'     // dispatch to command bus
  | 'handle-commands'       // register command handlers
  | 'access-service'        // call registered services
  | 'read-filesystem'       // read allowed file paths
  | 'write-filesystem'      // write allowed file paths
  | 'network-outbound'      // make outbound HTTP calls
  | 'spawn-workers'         // create worker pool tasks
  | 'schedule-jobs'         // schedule recurring jobs
  | 'read-telemetry'        // read telemetry data
  | 'write-telemetry'       // emit custom telemetry
  | 'access-database'       // direct database access
  | 'load-modules'          // dynamically load other modules
  | 'manage-platform';      // platform-level operations (native only)

// ─── Built-in Capability Sets ─────────────────────────────────────────────

export const CAPABILITY_SETS: Readonly<Record<SandboxLevel, SandboxCapability[]>> = {
  strict: [
    'read-config',
    'publish-events',
    'subscribe-events',
    'write-telemetry',
  ],
  standard: [
    'read-config',
    'publish-events',
    'subscribe-events',
    'dispatch-commands',
    'handle-commands',
    'access-service',
    'read-filesystem',
    'network-outbound',
    'spawn-workers',
    'schedule-jobs',
    'write-telemetry',
  ],
  trusted: [
    'read-config',
    'write-config',
    'read-secret',
    'publish-events',
    'subscribe-events',
    'dispatch-commands',
    'handle-commands',
    'access-service',
    'read-filesystem',
    'write-filesystem',
    'network-outbound',
    'spawn-workers',
    'schedule-jobs',
    'read-telemetry',
    'write-telemetry',
    'access-database',
  ],
  native: [
    'read-config', 'write-config', 'read-secret',
    'publish-events', 'subscribe-events',
    'dispatch-commands', 'handle-commands',
    'access-service',
    'read-filesystem', 'write-filesystem',
    'network-outbound',
    'spawn-workers', 'schedule-jobs',
    'read-telemetry', 'write-telemetry',
    'access-database',
    'load-modules', 'manage-platform',
  ],
};

// ─── Resource Quota ───────────────────────────────────────────────────────

export interface ResourceQuota {
  readonly maxMemoryMb?: number;
  readonly maxCpuPercent?: number;
  readonly maxOpenFiles?: number;
  readonly maxNetworkRequestsPerSecond?: number;
  readonly maxWorkerTasks?: number;
  readonly maxScheduledJobs?: number;
  readonly maxEventHandlers?: number;
}

// ─── Violations ───────────────────────────────────────────────────────────

export interface SandboxViolation {
  readonly id: string;
  readonly sandboxId: SandboxId;
  readonly pluginId: PluginId;
  readonly kind: SandboxViolationKind;
  readonly severity: Severity;
  readonly description: string;
  readonly attemptedCapability?: SandboxCapability;
  readonly attemptedResource?: string;
  readonly action: SandboxViolationAction;
  readonly detectedAt: Date;
}

export type SandboxViolationKind =
  | 'unauthorized-capability'
  | 'unauthorized-file-path'
  | 'unauthorized-network-host'
  | 'quota-exceeded-memory'
  | 'quota-exceeded-cpu'
  | 'quota-exceeded-network'
  | 'quota-exceeded-workers'
  | 'unauthorized-service'
  | 'unauthorized-secret'
  | 'unauthorized-command';

// ─── Stats ────────────────────────────────────────────────────────────────

export interface SandboxStats {
  readonly sandboxId: SandboxId;
  readonly activeExecutions: number;
  readonly totalExecutions: number;
  readonly failedExecutions: number;
  readonly violationCount: number;
  readonly currentMemoryMb?: number;
  readonly currentCpuPercent?: number;
}

export interface SandboxResourceReport {
  readonly totalSandboxes: number;
  readonly activeSandboxes: number;
  readonly totalViolations: number;
  readonly totalMemoryMb: number;
  readonly sandboxes: SandboxStats[];
}
