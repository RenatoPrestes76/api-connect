import type { LoadedPlugin } from '../loader/plugin-loader.js';

export type PluginStatus = 'registered' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';

export interface PluginEntry {
  readonly plugin:  LoadedPlugin;
  status:           PluginStatus;
  startedAt?:       Date;
  stoppedAt?:       Date;
  lastError?:       Error;
  failureCount:     number;
}

export class PluginRegistry {
  private readonly _plugins = new Map<string, PluginEntry>();

  register(plugin: LoadedPlugin): void {
    const id = plugin.manifest.id;
    if (this._plugins.has(id)) {
      throw new Error(`Connector "${id}" is already registered`);
    }
    this._plugins.set(id, { plugin, status: 'registered', failureCount: 0 });
  }

  unregister(id: string): void {
    this._plugins.delete(id);
  }

  get(id: string): PluginEntry | null {
    return this._plugins.get(id) ?? null;
  }

  has(id: string): boolean {
    return this._plugins.has(id);
  }

  all(): PluginEntry[] {
    return Array.from(this._plugins.values());
  }

  byStatus(status: PluginStatus): PluginEntry[] {
    return this.all().filter((e) => e.status === status);
  }

  setStatus(id: string, status: PluginStatus): void {
    const entry = this._plugins.get(id);
    if (!entry) throw new Error(`Connector "${id}" not found in registry`);
    entry.status = status;
  }

  recordFailure(id: string, error: Error): void {
    const entry = this._plugins.get(id);
    if (!entry) return;
    entry.status     = 'failed';
    entry.lastError  = error;
    entry.failureCount++;
  }

  get size(): number { return this._plugins.size; }
}
