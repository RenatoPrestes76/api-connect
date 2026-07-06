/**
 * @seltriva/core/factories
 * Factory and Builder interfaces — object creation abstractions
 */

// ─── Generic Factory ────────────────────────────────────────────────────────

/**
 * Creates instances of type T from a configuration
 */
export interface Factory<T> {
  create(config?: Record<string, unknown>): T;
  createAsync?(config?: Record<string, unknown>): Promise<T>;
  canCreate(config?: Record<string, unknown>): boolean;
}

// ─── Generic Builder ────────────────────────────────────────────────────────

/**
 * Fluent builder for constructing complex objects step-by-step
 */
export interface Builder<T> {
  configure(config: Partial<T>): Builder<T>;
  build(): T;
  validate(): boolean;
  reset(): Builder<T>;
}

// ─── Driver Factory ─────────────────────────────────────────────────────────

/**
 * Creates driver instances by type key
 */
export interface DriverFactory {
  create(type: string, config: Record<string, unknown>): unknown; // returns Driver
  createDatabase(config: Record<string, unknown>): unknown; // returns DatabaseDriver
  createERP(config: Record<string, unknown>): unknown; // returns ERPDriver
  createStorage(config: Record<string, unknown>): unknown; // returns StorageDriver
  createNotification(config: Record<string, unknown>): unknown; // returns NotificationDriver
  createAI(config: Record<string, unknown>): unknown; // returns AIProviderDriver
  createAuth(config: Record<string, unknown>): unknown; // returns AuthDriver
  supports(type: string): boolean;
}

// ─── Plugin Factory ─────────────────────────────────────────────────────────

/**
 * Instantiates plugin objects from metadata or paths
 */
export interface PluginFactory {
  create(id: string, config?: Record<string, unknown>): unknown; // returns Plugin
  createFromPath(path: string): Promise<unknown>; // returns Plugin
  canCreate(id: string): boolean;
}

// ─── Command Handler Factory ────────────────────────────────────────────────

/**
 * Resolves and instantiates the correct handler for a command type
 */
export interface CommandHandlerFactory {
  create(commandType: string): unknown; // returns CommandHandler
  register(commandType: string, handlerClass: new () => unknown): void;
  supports(commandType: string): boolean;
}

// ─── Event Handler Factory ──────────────────────────────────────────────────

/**
 * Resolves and instantiates handlers for a given event type
 */
export interface EventHandlerFactory {
  create(eventType: string): unknown[]; // returns EventHandler[]
  register(eventType: string, handlerClass: new () => unknown): void;
  supports(eventType: string): boolean;
}

// ─── Repository Factory ─────────────────────────────────────────────────────

/**
 * Creates repository instances for a given entity type
 */
export interface RepositoryFactory {
  create<TEntity>(entityName: string): unknown; // returns Repository<TEntity>
  register(entityName: string, repositoryClass: new () => unknown): void;
  supports(entityName: string): boolean;
}

// ─── Abstract Factory (family of related factories) ──────────────────────────

/**
 * Creates a coordinated family of objects for a given context
 */
export interface AbstractFactory<TFamily extends Record<string, unknown>> {
  createFamily(context: Record<string, unknown>): TFamily;
  supports(context: Record<string, unknown>): boolean;
  getName(): string;
}
