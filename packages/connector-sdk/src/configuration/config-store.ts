export class ConfigMissingError extends Error {
  constructor(key: string) {
    super(`Required config key "${key}" is not set`);
    this.name = 'ConfigMissingError';
  }
}

/** Read-only view of the connector's configuration. Injected by the Runtime. */
export interface ConfigStore {
  get<T = unknown>(key: string): T | undefined;
  getRequired<T = unknown>(key: string): T;
  getString(key: string, defaultValue?: string): string | undefined;
  getNumber(key: string, defaultValue?: number): number | undefined;
  getBoolean(key: string, defaultValue?: boolean): boolean | undefined;
  has(key: string): boolean;
  keys(): string[];
}

/** Mutable config store used internally and in tests. */
export class InMemoryConfigStore implements ConfigStore {
  private readonly _data: Map<string, unknown>;

  constructor(initial: Record<string, unknown> = {}) {
    this._data = new Map(Object.entries(initial));
  }

  set(key: string, value: unknown): void {
    this._data.set(key, value);
  }

  get<T = unknown>(key: string): T | undefined {
    return this._data.get(key) as T | undefined;
  }

  getRequired<T = unknown>(key: string): T {
    const value = this._data.get(key);
    if (value === undefined || value === null) throw new ConfigMissingError(key);
    return value as T;
  }

  getString(key: string, defaultValue?: string): string | undefined {
    const v = this._data.get(key);
    return v !== undefined ? String(v) : defaultValue;
  }

  getNumber(key: string, defaultValue?: number): number | undefined {
    const v = this._data.get(key);
    if (v === undefined) return defaultValue;
    const n = Number(v);
    return isNaN(n) ? defaultValue : n;
  }

  getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const v = this._data.get(key);
    if (v === undefined) return defaultValue;
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return defaultValue;
  }

  has(key: string): boolean {
    return this._data.has(key);
  }

  keys(): string[] {
    return Array.from(this._data.keys());
  }

  toObject(): Record<string, unknown> {
    return Object.fromEntries(this._data);
  }
}
