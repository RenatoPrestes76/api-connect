/**
 * @seltriva/runtime/module-loader
 * Module Loader — dynamic loading, versioning, and hot-reload of runtime modules
 *
 * The module loader manages the physical loading of module code.
 * While the lifecycle manager controls state, the module loader
 * controls the code assets: where they come from, which version
 * is active, and how they are isolated.
 *
 * Module sources:
 *   - Package workspace (built-in modules: @seltriva/*)
 *   - NPM registry (external modules)
 *   - Local file path (development)
 *   - Remote URL (dynamic loading)
 */

import type { RuntimeResult, ModuleId, Disposable } from '../kernel/index';
import type { ModuleDescriptor } from '../kernel/index';
import type { LifecycleModule } from '../lifecycle/index';

// ─── Module Loader ────────────────────────────────────────────────────────

export interface ModuleLoader {
  /**
   * Load a module from a source
   */
  load(source: ModuleSource): Promise<RuntimeResult<LoadedModule>>;

  /**
   * Unload a module (removes from memory)
   */
  unload(moduleId: ModuleId): Promise<RuntimeResult<void>>;

  /**
   * Reload a module in-place (hot-reload)
   */
  reload(moduleId: ModuleId): Promise<RuntimeResult<LoadedModule>>;

  /**
   * Discover all modules available in a directory
   */
  discover(dirPath: string): Promise<RuntimeResult<ModuleManifest[]>>;

  /**
   * Get a loaded module
   */
  get(moduleId: ModuleId): LoadedModule | null;

  /**
   * Get all loaded modules
   */
  getAll(): LoadedModule[];

  /**
   * Check if a module is loaded
   */
  isLoaded(moduleId: ModuleId): boolean;

  /**
   * Resolve a module's file path from its ID
   */
  resolve(moduleId: ModuleId): string | null;

  /**
   * Subscribe to loader events
   */
  onEvent(handler: ModuleLoaderEventHandler): Disposable;
}

// ─── Module Manifest ──────────────────────────────────────────────────────

/**
 * Static declaration of a module — read from package.json or manifest file.
 * This is the on-disk representation before loading.
 */
export interface ModuleManifest {
  readonly id: ModuleId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly entryPoint: string;
  readonly kind: string;
  readonly dependencies: ModuleId[];
  readonly provides: string[];
  readonly consumes: string[];
  readonly isLazyLoaded?: boolean;
  readonly hotReloadable?: boolean;
  readonly metadata?: Record<string, unknown>;
}

// ─── Module Source ────────────────────────────────────────────────────────

export type ModuleSource =
  | WorkspaceModuleSource
  | FileModuleSource
  | NpmModuleSource
  | RemoteModuleSource;

export interface WorkspaceModuleSource {
  readonly kind: 'workspace';
  readonly packageName: string;
  readonly version?: string;
}

export interface FileModuleSource {
  readonly kind: 'file';
  readonly filePath: string;
  readonly watchForChanges?: boolean;
}

export interface NpmModuleSource {
  readonly kind: 'npm';
  readonly packageName: string;
  readonly version: string;
  readonly registry?: string;
}

export interface RemoteModuleSource {
  readonly kind: 'remote';
  readonly url: string;
  readonly checksum?: string;
  readonly timeoutMs?: number;
}

// ─── Loaded Module ────────────────────────────────────────────────────────

export interface LoadedModule {
  readonly id: ModuleId;
  readonly manifest: ModuleManifest;
  readonly source: ModuleSource;
  readonly instance: LifecycleModule;
  readonly loadedAt: Date;
  readonly version: string;
  readonly checksum?: string;
}

// ─── Module Catalog ───────────────────────────────────────────────────────

export interface ModuleCatalog {
  register(manifest: ModuleManifest): void;
  get(moduleId: ModuleId): ModuleManifest | null;
  search(query: ModuleCatalogQuery): ModuleManifest[];
  getAll(): ModuleManifest[];
  has(moduleId: ModuleId): boolean;
}

export interface ModuleCatalogQuery {
  readonly kind?: string;
  readonly tags?: string[];
  readonly providesService?: string;
  readonly consumesService?: string;
}

// ─── Module Versioning ────────────────────────────────────────────────────

export interface ModuleVersionRegistry {
  registerVersion(moduleId: ModuleId, version: string, source: ModuleSource): void;
  getActiveVersion(moduleId: ModuleId): string | null;
  setActiveVersion(moduleId: ModuleId, version: string): RuntimeResult<void>;
  listVersions(moduleId: ModuleId): string[];
  rollback(moduleId: ModuleId): RuntimeResult<void>;
}

// ─── Events ───────────────────────────────────────────────────────────────

export type ModuleLoaderEventKind =
  | 'loading'
  | 'loaded'
  | 'unloaded'
  | 'reloaded'
  | 'load-failed'
  | 'discovered';

export interface ModuleLoaderEvent {
  readonly kind: ModuleLoaderEventKind;
  readonly moduleId: ModuleId;
  readonly version?: string;
  readonly error?: string;
  readonly timestamp: Date;
}

export type ModuleLoaderEventHandler = (event: ModuleLoaderEvent) => void;
