/**
 * @seltriva/core/exceptions
 * Core exception types for the platform
 */

/**
 * Base exception for all Seltriva Core errors
 */
export interface CoreException extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
  readonly originalError?: Error;
}

/**
 * Configuration-related exceptions
 */
export interface ConfigurationException extends CoreException {
  readonly code: 'CONFIG_ERROR' | 'CONFIG_VALIDATION_ERROR' | 'CONFIG_NOT_FOUND';
}

/**
 * Dependency injection related exceptions
 */
export interface DIException extends CoreException {
  readonly code: 'DI_NOT_FOUND' | 'DI_ALREADY_REGISTERED' | 'DI_CIRCULAR_DEPENDENCY' | 'DI_RESOLUTION_ERROR';
}

/**
 * Registry related exceptions
 */
export interface RegistryException extends CoreException {
  readonly code: 'REGISTRY_NOT_FOUND' | 'REGISTRY_ALREADY_REGISTERED' | 'REGISTRY_INVALID_TYPE';
}

/**
 * Plugin related exceptions
 */
export interface PluginException extends CoreException {
  readonly code: 'PLUGIN_NOT_FOUND' | 'PLUGIN_INIT_ERROR' | 'PLUGIN_LOAD_ERROR' | 'PLUGIN_INVALID';
}

/**
 * Event bus related exceptions
 */
export interface EventBusException extends CoreException {
  readonly code: 'EVENT_HANDLER_ERROR' | 'EVENT_LISTENER_ERROR' | 'EVENT_INVALID';
}

/**
 * Command bus related exceptions
 */
export interface CommandBusException extends CoreException {
  readonly code: 'COMMAND_NOT_FOUND' | 'COMMAND_HANDLER_ERROR' | 'COMMAND_INVALID';
}

/**
 * Discovery related exceptions
 */
export interface DiscoveryException extends CoreException {
  readonly code: 'DISCOVERY_ERROR' | 'DISCOVERY_NOT_FOUND' | 'DISCOVERY_INVALID';
}

/**
 * Driver related exceptions
 */
export interface DriverException extends CoreException {
  readonly code: 'DRIVER_NOT_FOUND' | 'DRIVER_NOT_COMPATIBLE' | 'DRIVER_ERROR';
}

/**
 * Mapping related exceptions
 */
export interface MappingException extends CoreException {
  readonly code: 'MAPPING_NOT_FOUND' | 'MAPPING_ERROR' | 'MAPPING_INVALID_SCHEMA';
}

/**
 * Sync related exceptions
 */
export interface SyncException extends CoreException {
  readonly code: 'SYNC_ERROR' | 'SYNC_CONFLICT' | 'SYNC_TIMEOUT';
}
