/**
 * @seltriva/core/decorators
 * TypeScript decorator interfaces and metadata contracts
 *
 * These interfaces describe the shape of decorator factories and the metadata
 * they attach via reflect-metadata. Concrete decorator implementations live in
 * each feature package — this module only defines the contracts.
 */

// ─── DI Decorators ──────────────────────────────────────────────────────────

/**
 * Options for the @Injectable decorator
 */
export interface InjectableOptions {
  /** DI scope: singleton (default), transient, or request-scoped */
  readonly scope?: 'singleton' | 'transient' | 'request';
  /** Optional token override (defaults to the class constructor) */
  readonly token?: string | symbol;
}

/**
 * Metadata stored by @Injectable on a class
 */
export interface InjectableMetadata {
  readonly scope: 'singleton' | 'transient' | 'request';
  readonly token?: string | symbol;
}

/**
 * Options for the @Inject parameter decorator
 */
export interface InjectOptions {
  readonly token: string | symbol;
  readonly optional?: boolean;
}

// ─── Event Decorators ───────────────────────────────────────────────────────

/**
 * Options for the @SubscribeTo class/method decorator
 */
export interface SubscribeToOptions {
  /** Event type string to subscribe to */
  readonly eventType: string;
  /** Filter predicate — only handle events matching this condition */
  readonly filter?: (event: unknown) => boolean;
}

/**
 * Metadata attached by @SubscribeTo
 */
export interface EventHandlerMetadata {
  readonly eventType: string;
  readonly methodName: string;
  readonly filter?: (event: unknown) => boolean;
}

// ─── Command Decorators ─────────────────────────────────────────────────────

/**
 * Options for the @HandleCommand class/method decorator
 */
export interface HandleCommandOptions {
  readonly commandType: string;
}

/**
 * Metadata attached by @HandleCommand
 */
export interface CommandHandlerMetadata {
  readonly commandType: string;
  readonly methodName: string;
}

// ─── Validation Decorators ──────────────────────────────────────────────────

/**
 * Options for the @Validate property decorator
 */
export interface ValidateOptions {
  readonly required?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  readonly min?: number;
  readonly max?: number;
  readonly message?: string;
}

/**
 * Per-property validation rule attached by @Validate
 */
export interface PropertyValidationMetadata {
  readonly propertyName: string;
  readonly rules: ValidateOptions;
}

// ─── Repository Decorators ──────────────────────────────────────────────────

/**
 * Options for the @Repository class decorator
 */
export interface RepositoryOptions {
  /** Name of the entity this repository manages */
  readonly entity: string;
  /** Optional data source key (for multi-tenant or multi-db scenarios) */
  readonly dataSource?: string;
}

/**
 * Metadata attached by @Repository
 */
export interface RepositoryMetadata {
  readonly entity: string;
  readonly dataSource?: string;
}

// ─── Driver Decorators ──────────────────────────────────────────────────────

/**
 * Options for the @Driver class decorator
 */
export interface DriverDecoratorOptions {
  readonly type: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities?: string[];
}

/**
 * Metadata attached by @Driver
 */
export interface DriverDecoratorMetadata {
  readonly type: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: string[];
}

// ─── Plugin Decorators ──────────────────────────────────────────────────────

/**
 * Options for the @PluginDescriptor class decorator
 */
export interface PluginDecoratorOptions {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  readonly capabilities?: string[];
  readonly dependencies?: string[];
}

// ─── Metadata Reflection Keys ────────────────────────────────────────────────

/**
 * Well-known reflect-metadata keys used across the platform
 */
export const METADATA_KEYS = {
  INJECTABLE: Symbol('seltriva:injectable'),
  INJECT: Symbol('seltriva:inject'),
  EVENT_HANDLER: Symbol('seltriva:event-handler'),
  COMMAND_HANDLER: Symbol('seltriva:command-handler'),
  VALIDATE: Symbol('seltriva:validate'),
  REPOSITORY: Symbol('seltriva:repository'),
  DRIVER: Symbol('seltriva:driver'),
  PLUGIN: Symbol('seltriva:plugin'),
} as const;

export type MetadataKey = (typeof METADATA_KEYS)[keyof typeof METADATA_KEYS];
