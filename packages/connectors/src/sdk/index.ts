/**
 * @seltriva/connectors/sdk
 * Connector Plugin SDK — contracts for authoring and distributing new connectors
 */

import type {
  Connector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorDescriptor,
  ConnectorType,
} from '../core/index';
import type { CapabilitySet } from '../capabilities/index';
import type { ConnectorConfigSchema } from '../registry/index';

// ─── Connector Plugin ─────────────────────────────────────────────────────

/**
 * A Connector Plugin packages a connector implementation for distribution.
 * Every third-party connector must implement this interface.
 */
export interface ConnectorPlugin {
  /** Unique plugin id — e.g. "seltriva-connector-snowflake" */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Semantic version */
  readonly version: string;

  /** The UDCF spec version this plugin was built against */
  readonly sdkVersion: string;

  /** One-line description */
  readonly description: string;

  /** The connector type this plugin provides */
  readonly connectorType: ConnectorType | string;

  /** Config schema used by the UI to render a connection form */
  readonly configSchema: ConnectorConfigSchema;

  /** Author info */
  readonly author: PluginAuthor;

  /** Plugin lifecycle hooks */
  readonly lifecycle: PluginLifecycle;

  /** Factory: creates a connector instance from a validated config */
  createConnector(config: ConnectorConfig): Promise<Connector>;

  /** Validate a config before creating an instance */
  validateConfig(config: ConnectorConfig): Promise<ConnectorResult<PluginConfigValidationResult>>;

  /** Describe what capabilities a connector with this config would have */
  describeCapabilities(config: ConnectorConfig): CapabilitySet;

  /** Return a static descriptor without creating a connector */
  getDescriptor(): ConnectorDescriptor;
}

export interface PluginAuthor {
  readonly name: string;
  readonly email?: string;
  readonly url?: string;
}

export interface PluginLifecycle {
  /** Called once when the plugin is loaded into the registry */
  onInstall?(registry: PluginRegistry): Promise<void>;

  /** Called when the plugin is unloaded */
  onUninstall?(): Promise<void>;

  /** Called on each SDK version upgrade */
  onUpgrade?(fromVersion: string, toVersion: string): Promise<void>;
}

export interface PluginConfigValidationResult {
  readonly isValid: boolean;
  readonly errors: Array<{ field: string; message: string; code: string }>;
  readonly warnings: Array<{ field: string; message: string }>;
  readonly suggestions?: Array<{ field: string; value: unknown; reason: string }>;
}

// ─── Plugin Registry ──────────────────────────────────────────────────────

/**
 * Manages plugin lifecycle in a running process.
 * Distinct from ConnectorRegistry — this tracks plugins, not connector instances.
 */
export interface PluginRegistry {
  install(plugin: ConnectorPlugin): Promise<void>;
  uninstall(pluginId: string): Promise<void>;
  upgrade(pluginId: string, newPlugin: ConnectorPlugin): Promise<void>;

  get(pluginId: string): ConnectorPlugin | null;
  getAll(): ConnectorPlugin[];
  has(pluginId: string): boolean;

  getByType(connectorType: ConnectorType | string): ConnectorPlugin[];
  findByCapability(capability: string): ConnectorPlugin[];

  /** List installed plugin versions — for update checks */
  getVersion(pluginId: string): string | null;

  onChange(handler: (event: PluginRegistryEvent) => void): string;
  offChange(subscriptionId: string): void;
}

export interface PluginRegistryEvent {
  readonly type: 'installed' | 'uninstalled' | 'upgraded';
  readonly pluginId: string;
  readonly plugin?: ConnectorPlugin;
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly timestamp: Date;
}

// ─── Plugin Manifest ──────────────────────────────────────────────────────

/**
 * Static declaration file (package.json#seltrivaConnector or connector.manifest.json).
 * Used for discovery before the plugin is loaded.
 */
export interface ConnectorManifest {
  readonly pluginId: string;
  readonly name: string;
  readonly version: string;
  readonly sdkVersion: string;
  readonly description: string;
  readonly connectorType: ConnectorType | string;
  readonly keywords?: string[];
  readonly logo?: string;
  readonly documentationUrl?: string;
  readonly repositoryUrl?: string;
  readonly author: PluginAuthor;
  readonly license?: string;
  readonly capabilities?: string[];
  readonly configSchema: ConnectorConfigSchema;
  readonly entryPoint: string;
}

// ─── Plugin Loader ────────────────────────────────────────────────────────

/**
 * Discovers and loads plugins from the filesystem or a remote registry.
 */
export interface PluginLoader {
  /** Load from a Node module path */
  loadFromPath(path: string): Promise<ConnectorPlugin>;

  /** Load from an npm package name (requires the package to be installed) */
  loadFromPackage(packageName: string): Promise<ConnectorPlugin>;

  /** Discover all plugins in a directory by reading manifests */
  discoverFromDirectory(dir: string): Promise<ConnectorManifest[]>;

  /** Resolve a manifest to a fully loaded plugin */
  resolve(manifest: ConnectorManifest): Promise<ConnectorPlugin>;

  /** Validate a plugin satisfies the SDK contract */
  validate(plugin: ConnectorPlugin): Promise<PluginValidationResult>;
}

export interface PluginValidationResult {
  readonly isValid: boolean;
  readonly errors: PluginValidationError[];
  readonly warnings: PluginValidationWarning[];
}

export interface PluginValidationError {
  readonly code: PluginValidationErrorCode;
  readonly message: string;
  readonly field?: string;
}

export interface PluginValidationWarning {
  readonly code: string;
  readonly message: string;
}

export type PluginValidationErrorCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_SDK_VERSION'
  | 'MISSING_LIFECYCLE_HOOK'
  | 'INVALID_CONFIG_SCHEMA'
  | 'INVALID_CONNECTOR_TYPE'
  | 'FACTORY_NOT_CALLABLE'
  | 'VERSION_FORMAT_INVALID';

// ─── Test Harness ─────────────────────────────────────────────────────────

/**
 * SDK-provided test harness for verifying plugin correctness.
 * Implementors use this to validate their connector against the UDCF contract.
 */
export interface PluginTestHarness {
  /**
   * Run the full UDCF compliance suite against a connector instance.
   * This tests: connect, health, discover, metadata, capabilities, disconnect.
   */
  runComplianceSuite(
    plugin: ConnectorPlugin,
    config: ConnectorConfig
  ): Promise<ComplianceReport>;

  /** Test only the config validation flow */
  testConfigValidation(
    plugin: ConnectorPlugin,
    validConfig: ConnectorConfig,
    invalidConfigs: Array<{ config: ConnectorConfig; expectedField: string }>
  ): Promise<ConfigValidationTestResult>;

  /** Test the capability declaration matches actual behavior */
  testCapabilities(
    plugin: ConnectorPlugin,
    config: ConnectorConfig,
    expectations: CapabilityExpectation[]
  ): Promise<CapabilityTestResult>;
}

export interface ComplianceReport {
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly testRunId: string;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly passed: boolean;
  readonly results: ComplianceTestResult[];
  readonly score: number;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ComplianceTestResult {
  readonly test: string;
  readonly category: 'core' | 'capabilities' | 'metadata' | 'health' | 'discovery' | 'error-handling';
  readonly passed: boolean;
  readonly durationMs: number;
  readonly error?: string;
  readonly details?: Record<string, unknown>;
}

export interface ConfigValidationTestResult {
  readonly passed: boolean;
  readonly validConfigAccepted: boolean;
  readonly invalidConfigsRejected: Array<{
    config: ConnectorConfig;
    expectedField: string;
    wasRejected: boolean;
    rejectedField?: string;
  }>;
}

export interface CapabilityExpectation {
  readonly capability: string;
  readonly expected: boolean;
  readonly testFn?: (connector: Connector) => Promise<boolean>;
}

export interface CapabilityTestResult {
  readonly passed: boolean;
  readonly results: Array<{
    capability: string;
    expected: boolean;
    declared: boolean;
    behaviorallyVerified?: boolean;
    passed: boolean;
  }>;
}

// ─── Connector Base Class Contract ────────────────────────────────────────

/**
 * Abstract shape that third-party connectors are expected to follow.
 * This is not a class — it is an interface describing the abstract connector contract
 * so that plugin authors have a clear target to implement.
 */
export interface AbstractConnectorContract {
  /** Initialization: called once by the factory after construction */
  initialize(config: ConnectorConfig): Promise<void>;

  /** Teardown: release all resources */
  destroy(): Promise<void>;

  /** Optional: hook called before health check */
  beforeHealthCheck?(): Promise<void>;

  /** Optional: hook called before discovery */
  beforeDiscovery?(): Promise<void>;
}

// ─── SDK Version ──────────────────────────────────────────────────────────

export const CONNECTOR_SDK_VERSION = '0.1.0' as const;

export interface SdkVersionInfo {
  readonly version: string;
  readonly minPluginVersion: string;
  readonly maxPluginVersion: string;
}

export function getSdkVersionInfo(): SdkVersionInfo {
  return {
    version: CONNECTOR_SDK_VERSION,
    minPluginVersion: '0.1.0',
    maxPluginVersion: '0.x',
  };
}
