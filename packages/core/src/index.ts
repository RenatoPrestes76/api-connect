/**
 * @seltriva/core
 * Enterprise Core Architecture — public API
 *
 * Interfaces + concrete domain base classes.
 */

// ─── Concrete Domain Implementations ───────────────────────────────────────
export { ValueObject } from './domain/value-object.js';
export { Entity, AggregateRoot } from './domain/entity.js';
export { Result, unwrap, getOrUndefined, getOrDefault } from './domain/result.js';

// ─── Domain-Driven Design + DI ──────────────────────────────────────────────
// ValueObject/Entity/AggregateRoot are intentionally NOT re-exported here — the
// concrete classes above (lines 9-10) already export those names as both value
// and type; re-exporting the interfaces/index.ts contracts under the same bare
// names would collide (TS2300 duplicate identifier).
export type {
  DomainEvent,
  Repository,
  RepositoryCriteria,
  UnitOfWork,
  Specification,
  DomainService,
  DIContainer,
  DIRegistrationOptions,
  ServiceLocator,
} from './interfaces/index';

// ─── Event Bus (EDA) ────────────────────────────────────────────────────────
export type {
  Event,
  EventHandler,
  EventListener,
  EventPublisher,
  EventSubscriber,
  EventBus,
  EventInterceptor,
  EventReplayer,
  EventReplayStatus,
  EventStore,
} from './events/index';

// ─── Command Bus (CQRS) ─────────────────────────────────────────────────────
export type {
  Command,
  CommandResult,
  CommandHandler,
  CommandPublisher,
  CommandHandlerRegistry,
  CommandBus,
  CommandValidator,
  CommandValidationResult,
  ValidationRule,
  CommandMiddleware,
  Query,
  QueryHandler,
  QueryBus,
} from './commands/index';

// ─── Drivers ────────────────────────────────────────────────────────────────
export type {
  Driver,
  DriverMetadata,
  DatabaseDriver,
  DatabaseSchema,
  Table,
  Column,
  View,
  Index,
  ForeignKey,
  ERPDriver,
  CacheDriver,
  StorageDriver,
  NotificationDriver,
  NotificationMessage,
  BatchNotification,
  NotificationStatus,
  AIProviderDriver,
  AICompletionOptions,
  AICompletionResult,
  AIUsage,
  AuthDriver,
  AuthToken,
  AuthClaims,
} from './drivers/index';

// ─── Plugins ────────────────────────────────────────────────────────────────
export type {
  Plugin,
  PluginContext,
  PluginMetadata,
  PluginManager,
  PluginDependencyTree,
  PluginLoader,
  PluginHook,
  PluginHookSystem,
  PluginLifecycleEvent,
  PluginLifecycleObserver,
} from './plugins/index';

// ─── Configuration ──────────────────────────────────────────────────────────
export type {
  ConfigurationManager,
  ConfigurationSchema,
  ConfigValidationResult,
  ConfigurationProvider,
  EnvironmentConfigurationProvider,
  FileConfigurationProvider,
  RemoteConfigurationProvider,
  SecretProvider,
  ConfigurationLoader,
} from './configuration/index';

// ─── Discovery ──────────────────────────────────────────────────────────────
export type {
  ServiceDiscovery,
  ServiceInstance,
  TypeDiscovery,
  ClassMetadata,
  PropertyMetadata,
  MethodMetadata,
  ParameterMetadata,
  ModuleDiscovery,
  Module,
  DiscoveryValidationResult,
  DriverDiscovery,
  DriverDescriptor,
} from './discovery/index';

// ─── Mapping ────────────────────────────────────────────────────────────────
export type {
  Mapper,
  MappingDefinition,
  PropertyMapping,
  SchemaMapper,
  SchemaDefinition,
  FieldDefinition,
  FieldTransform,
  FieldValidation,
  MappingValidationResult,
  TransformationPipeline,
  TransformationStep,
  FieldMappingRegistry,
  FieldMapping,
  FieldMappingTable,
} from './mapping/index';

// ─── Sync ───────────────────────────────────────────────────────────────────
export type {
  SyncEngine,
  SyncResult,
  SyncError,
  SyncStatus,
  SyncHistory,
  SyncStrategy,
  SyncContext,
  SyncSource,
  SyncTarget,
  SyncConfiguration,
  ConflictResolver,
  ChangeDataCapture,
  DataChange,
  FieldChange,
  SyncScheduler,
  SyncJob,
} from './sync/index';

// ─── Registry ───────────────────────────────────────────────────────────────
export type {
  Registry,
  DatabaseDriverRegistry,
  DatabaseDriverEntry,
  ERPDriverRegistry,
  ERPDriverEntry,
  AIProviderRegistry,
  AIProviderEntry,
  AuthenticationProviderRegistry,
  AuthProviderEntry,
  StorageProviderRegistry,
  StorageProviderEntry,
  NotificationProviderRegistry,
  NotificationProviderEntry,
  RegistryManager,
} from './registry/index';

// ─── Abstractions (Design Patterns) ─────────────────────────────────────────
export type {
  Strategy,
  StrategySelector,
  ChainHandler,
  Observer,
  Observable,
  Decorator,
  Adapter,
  TemplateMethod,
  TemplateStep,
  Proxy,
  ProxyInterceptor,
  ProxyContext,
} from './abstractions/index';

// ─── Services (Middleware, Interceptors, Logger) ─────────────────────────────
export type {
  Middleware,
  RequestContext,
  ResponseContext,
  Pipeline,
  Interceptor,
  InterceptorChain,
  ErrorInterceptor,
  ErrorMiddleware,
  HealthCheck,
  HealthCheckResult,
  HealthCheckRegistry,
  Logger,
} from './services/index';

// ─── Factories ──────────────────────────────────────────────────────────────
export type {
  Factory,
  Builder,
  DriverFactory,
  PluginFactory,
  CommandHandlerFactory,
  EventHandlerFactory,
  RepositoryFactory,
  AbstractFactory,
} from './factories/index';

// ─── Decorators ─────────────────────────────────────────────────────────────
export type {
  InjectableOptions,
  InjectableMetadata,
  InjectOptions,
  SubscribeToOptions,
  EventHandlerMetadata,
  HandleCommandOptions,
  CommandHandlerMetadata,
  ValidateOptions,
  PropertyValidationMetadata,
  RepositoryOptions,
  RepositoryMetadata,
  DriverDecoratorOptions,
  DriverDecoratorMetadata,
  PluginDecoratorOptions,
  MetadataKey,
} from './decorators/index';

// ─── Constants (re-exported as values, not types) ───────────────────────────
export {
  CORE_MODULES,
  DRIVER_TYPES,
  PROVIDER_TYPES,
  PLUGIN_LIFECYCLE,
  EVENT_PRIORITIES,
  SYNC_MODES,
  MAPPING_TYPES,
  REGISTRY_SCOPES,
} from './constants/index';

export { METADATA_KEYS } from './decorators/index';

// ─── Exceptions ─────────────────────────────────────────────────────────────
export type {
  CoreException,
  ConfigurationException,
  DIException,
  RegistryException,
  PluginException,
  EventBusException,
  CommandBusException,
  DiscoveryException,
  DriverException,
  MappingException,
  SyncException,
} from './exceptions/index';
