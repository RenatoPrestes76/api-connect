/**
 * @seltriva/core/constants
 * Core constants for the platform
 */

/**
 * Core module names
 */
export const CORE_MODULES = {
  CONFIGURATION: 'core.configuration',
  CONTAINER: 'core.container',
  REGISTRY: 'core.registry',
  EVENT_BUS: 'core.event-bus',
  COMMAND_BUS: 'core.command-bus',
  PLUGIN_MANAGER: 'core.plugin-manager',
  DISCOVERY: 'core.discovery',
} as const;

/**
 * Driver types
 */
export const DRIVER_TYPES = {
  DATABASE: 'database',
  ERP: 'erp',
  CACHE: 'cache',
  STORAGE: 'storage',
  NOTIFICATION: 'notification',
  AUTH: 'auth',
  MESSAGING: 'messaging',
} as const;

/**
 * Provider types
 */
export const PROVIDER_TYPES = {
  AI: 'ai',
  AUTHENTICATION: 'authentication',
  STORAGE: 'storage',
  NOTIFICATION: 'notification',
  PAYMENT: 'payment',
} as const;

/**
 * Plugin lifecycle events
 */
export const PLUGIN_LIFECYCLE = {
  BEFORE_INITIALIZE: 'plugin:before-initialize',
  AFTER_INITIALIZE: 'plugin:after-initialize',
  BEFORE_ACTIVATE: 'plugin:before-activate',
  AFTER_ACTIVATE: 'plugin:after-activate',
  BEFORE_DEACTIVATE: 'plugin:before-deactivate',
  AFTER_DEACTIVATE: 'plugin:after-deactivate',
  BEFORE_UNLOAD: 'plugin:before-unload',
  AFTER_UNLOAD: 'plugin:after-unload',
} as const;

/**
 * Event priorities
 */
export const EVENT_PRIORITIES = {
  CRITICAL: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  DEFERRED: 0,
} as const;

/**
 * Sync modes
 */
export const SYNC_MODES = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
  DELTA: 'delta',
  BATCH: 'batch',
  STREAM: 'stream',
} as const;

/**
 * Mapping types
 */
export const MAPPING_TYPES = {
  FIELD: 'field',
  OBJECT: 'object',
  ARRAY: 'array',
  CUSTOM: 'custom',
} as const;

/**
 * Registry scopes
 */
export const REGISTRY_SCOPES = {
  GLOBAL: 'global',
  MODULE: 'module',
  REQUEST: 'request',
} as const;
