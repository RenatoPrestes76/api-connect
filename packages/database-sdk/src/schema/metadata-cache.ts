import type { SchemaReader, DatabaseSchema } from './schema-reader.js';

export interface MetadataCacheOptions {
  readonly ttlMs?: number;
}

export class MetadataCache {
  private _schema:    DatabaseSchema | null = null;
  private _loadedAt:  Date | null = null;
  private readonly _ttlMs: number;

  constructor(
    private readonly _reader: SchemaReader,
    options: MetadataCacheOptions = {},
  ) {
    this._ttlMs = options.ttlMs ?? 5 * 60 * 1_000;
  }

  get isLoaded(): boolean  { return this._schema !== null; }

  get isStale(): boolean {
    if (!this._loadedAt) return true;
    return Date.now() - this._loadedAt.getTime() >= this._ttlMs;
  }

  get cachedAt(): Date | null { return this._loadedAt; }

  async load(): Promise<DatabaseSchema> {
    if (this._schema && !this.isStale) return this._schema;
    return this.refresh();
  }

  async refresh(): Promise<DatabaseSchema> {
    this._schema   = await this._reader.readSchema();
    this._loadedAt = new Date();
    return this._schema;
  }

  invalidate(): void {
    this._schema   = null;
    this._loadedAt = null;
  }

  peek(): DatabaseSchema | null { return this._schema; }
}
