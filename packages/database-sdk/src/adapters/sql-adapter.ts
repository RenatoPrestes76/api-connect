import type { DatabaseAdapter, DatabaseHealth } from './database-adapter.js';
import type { Query } from '../query/query-types.js';
import type { DatabaseSchema } from '../schema/schema-reader.js';
import type { Table } from '../schema/table.js';
import { SqlRenderer } from '../query/sql-renderer.js';
import type { DialectName } from '../query/sql-renderer.js';
import { ConnectionFailedError, TransactionError } from '../errors/database-errors.js';

export type { DriverConfig } from '../connection/connection-options.js';
import type { DriverConfig } from '../connection/connection-options.js';

export abstract class SqlAdapter implements DatabaseAdapter {
  protected _isConnected = false;
  protected readonly _renderer: SqlRenderer;

  constructor(
    protected readonly _config: DriverConfig,
    dialect: DialectName,
  ) {
    this._renderer = new SqlRenderer(dialect);
  }

  get isConnected(): boolean { return this._isConnected; }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (!this._isConnected) {
      throw new ConnectionFailedError('Cannot start transaction: not connected');
    }
    try {
      return await callback();
    } catch (err) {
      if (err instanceof TransactionError) throw err;
      throw new TransactionError(
        'Transaction rolled back: ' + (err instanceof Error ? err.message : String(err)),
        err instanceof Error ? err : undefined,
      );
    }
  }

  protected _mockSchema(name: string): DatabaseSchema {
    const users: Table = {
      name: 'users',
      columns: [
        { name: 'id',    type: 'integer', nullable: false, isPrimaryKey: true,  isForeignKey: false, isUnique: true  },
        { name: 'email', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: true  },
        { name: 'name',  type: 'varchar', nullable: true,  isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      primaryKey:  { columns: ['id'] },
      foreignKeys: [],
      indexes: [
        { name: 'pk_users', columns: ['id'],    isUnique: true,  isPrimary: true  },
        { name: 'uq_email', columns: ['email'], isUnique: true,  isPrimary: false },
      ],
    };

    const orders: Table = {
      name: 'orders',
      columns: [
        { name: 'id',      type: 'integer', nullable: false, isPrimaryKey: true,  isForeignKey: false, isUnique: true  },
        { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true,  isUnique: false },
        { name: 'total',   type: 'decimal', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      primaryKey:  { columns: ['id'] },
      foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
      indexes: [
        { name: 'pk_orders',   columns: ['id'],      isUnique: true,  isPrimary: true  },
        { name: 'idx_user_id', columns: ['user_id'], isUnique: false, isPrimary: false },
      ],
    };

    return {
      name,
      tables:    [users, orders],
      relations: [{
        fromTable:  'orders',
        fromColumn: 'user_id',
        toTable:    'users',
        toColumn:   'id',
        type:       'many-to-one',
      }],
      discoveredAt: new Date(),
    };
  }

  abstract connect():    Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract execute<T = unknown>(query: Query): Promise<T[]>;
  abstract health():     Promise<DatabaseHealth>;
  abstract schema():     Promise<DatabaseSchema>;
}
