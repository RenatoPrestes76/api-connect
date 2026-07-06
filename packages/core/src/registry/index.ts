/**
 * @seltriva/core/registry
 * Registry interfaces for all provider and driver registrations
 */

// ─── Generic Registry ──────────────────────────────────────────────────────

/**
 * Generic typed registry — the foundation for all specific registries
 */
export interface Registry<T> {
  register(key: string, item: T): void;
  unregister(key: string): boolean;
  get(key: string): T | null;
  getAll(): Record<string, T>;
  has(key: string): boolean;
  keys(): string[];
  clear(): void;
  count(): number;
}

// ─── Database Driver Registry ──────────────────────────────────────────────

export interface DatabaseDriverRegistry extends Registry<DatabaseDriverEntry> {
  getByDialect(dialect: string): DatabaseDriverEntry[];
  getDefault(): DatabaseDriverEntry | null;
  setDefault(key: string): void;
  findByCapability(capability: string): DatabaseDriverEntry[];
}

export interface DatabaseDriverEntry {
  readonly key: string;
  readonly driver: unknown; // DatabaseDriver
  readonly dialect: string;
  readonly version: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly capabilities: string[];
  readonly metadata?: Record<string, unknown>;
}

// ─── ERP Driver Registry ───────────────────────────────────────────────────

export interface ERPDriverRegistry extends Registry<ERPDriverEntry> {
  getBySystem(systemName: string): ERPDriverEntry[];
  getByVersion(systemName: string, version: string): ERPDriverEntry | null;
  findByCapability(capability: string): ERPDriverEntry[];
}

export interface ERPDriverEntry {
  readonly key: string;
  readonly driver: unknown; // ERPDriver
  readonly systemName: string;
  readonly systemVersion: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly capabilities: string[];
  readonly metadata?: Record<string, unknown>;
}

// ─── AI Provider Registry ──────────────────────────────────────────────────

export interface AIProviderRegistry extends Registry<AIProviderEntry> {
  getByCapability(capability: string): AIProviderEntry[];
  getDefault(): AIProviderEntry | null;
  setDefault(key: string): void;
  findByModel(model: string): AIProviderEntry[];
}

export interface AIProviderEntry {
  readonly key: string;
  readonly provider: unknown; // AIProviderDriver
  readonly name: string;
  readonly models: string[];
  readonly capabilities: string[];
  readonly priority: number;
  readonly enabled: boolean;
}

// ─── Authentication Provider Registry ─────────────────────────────────────

export interface AuthenticationProviderRegistry extends Registry<AuthProviderEntry> {
  getByStrategy(strategy: string): AuthProviderEntry[];
  getEnabledProviders(): AuthProviderEntry[];
  getDefault(): AuthProviderEntry | null;
  setDefault(key: string): void;
}

export interface AuthProviderEntry {
  readonly key: string;
  readonly provider: unknown; // AuthDriver
  readonly name: string;
  readonly strategy: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly config?: Record<string, unknown>;
}

// ─── Storage Provider Registry ─────────────────────────────────────────────

export interface StorageProviderRegistry extends Registry<StorageProviderEntry> {
  getByStorageType(type: string): StorageProviderEntry[];
  getDefault(): StorageProviderEntry | null;
  setDefault(key: string): void;
  findByLocation(location: string): StorageProviderEntry[];
}

export interface StorageProviderEntry {
  readonly key: string;
  readonly provider: unknown; // StorageDriver
  readonly name: string;
  readonly type: string;
  readonly location: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly config?: Record<string, unknown>;
}

// ─── Notification Provider Registry ───────────────────────────────────────

export interface NotificationProviderRegistry extends Registry<NotificationProviderEntry> {
  getByChannel(channel: string): NotificationProviderEntry[];
  getEnabledProviders(): NotificationProviderEntry[];
  findBySupportedChannels(channels: string[]): NotificationProviderEntry[];
}

export interface NotificationProviderEntry {
  readonly key: string;
  readonly provider: unknown; // NotificationDriver
  readonly name: string;
  readonly channels: string[];
  readonly priority: number;
  readonly enabled: boolean;
  readonly config?: Record<string, unknown>;
}

// ─── Registry Manager ──────────────────────────────────────────────────────

/**
 * Central manager that owns all provider and driver registries
 */
export interface RegistryManager {
  getDatabaseDriverRegistry(): DatabaseDriverRegistry;
  getERPDriverRegistry(): ERPDriverRegistry;
  getAIProviderRegistry(): AIProviderRegistry;
  getAuthenticationProviderRegistry(): AuthenticationProviderRegistry;
  getStorageProviderRegistry(): StorageProviderRegistry;
  getNotificationProviderRegistry(): NotificationProviderRegistry;
  registerCustomRegistry<T>(name: string, registry: Registry<T>): void;
  getCustomRegistry<T>(name: string): Registry<T> | null;
  getAllRegistries(): Record<string, Registry<unknown>>;
}
