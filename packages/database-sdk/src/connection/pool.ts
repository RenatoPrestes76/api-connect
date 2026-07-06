import type { DatabaseAdapter } from '../adapters/database-adapter.js';
import { ConnectionFailedError } from '../errors/database-errors.js';

export class ConnectionPool {
  private readonly _all:       DatabaseAdapter[] = [];
  private readonly _available: DatabaseAdapter[] = [];

  constructor(
    private readonly _factory: () => DatabaseAdapter,
    private readonly _size = 5,
  ) {}

  async initialize(): Promise<void> {
    for (let i = 0; i < this._size; i++) {
      const conn = this._factory();
      await conn.connect();
      this._all.push(conn);
      this._available.push(conn);
    }
  }

  async acquire(): Promise<DatabaseAdapter> {
    const conn = this._available.pop();
    if (!conn) throw new ConnectionFailedError('No connections available in pool');
    return conn;
  }

  release(conn: DatabaseAdapter): void {
    if (!this._all.includes(conn)) {
      throw new ConnectionFailedError('Connection is not part of this pool');
    }
    if (!this._available.includes(conn)) {
      this._available.push(conn);
    }
  }

  async drainAll(): Promise<void> {
    await Promise.all(this._all.map((c) => c.disconnect().catch(() => {})));
    this._all.length       = 0;
    this._available.length = 0;
  }

  get size():      number { return this._all.length; }
  get available(): number { return this._available.length; }
  get inUse():     number { return this._all.length - this._available.length; }

  get poolUsage(): number {
    return this._all.length === 0 ? 0 : this.inUse / this._all.length;
  }
}
