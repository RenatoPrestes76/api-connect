import type {
  SelectQuery, InsertQuery, UpdateQuery, DeleteQuery, RawQuery,
  Filter, OrderBy, Join,
} from './query-types.js';
import { equals } from './filters.js';
import { SqlRenderer } from './sql-renderer.js';
import type { RenderedQuery, DialectName } from './sql-renderer.js';
import { QueryError } from '../errors/database-errors.js';

export class QueryBuilder {
  private _table    = '';
  private _columns: string[]  = [];
  private _filters: Filter[]  = [];
  private _orderBys: OrderBy[] = [];
  private _joins:    Join[]    = [];
  private _limit:    number | undefined;
  private _offset:   number | undefined;

  select(columns: string | string[]): this {
    if (Array.isArray(columns)) {
      this._columns.push(...columns);
    } else {
      this._columns.push(columns);
    }
    return this;
  }

  from(table: string): this {
    this._table = table;
    return this;
  }

  where(filter: Filter): this;
  where(field: string, value: unknown): this;
  where(filterOrField: Filter | string, value?: unknown): this {
    if (typeof filterOrField === 'string') {
      this._filters.push(equals(filterOrField, value));
    } else {
      this._filters.push(filterOrField);
    }
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this._orderBys.push({ column, direction });
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  offset(n: number): this {
    this._offset = n;
    return this;
  }

  join(type: Join['type'], table: string, on: string): this {
    this._joins.push({ type, table, on });
    return this;
  }

  build(): SelectQuery {
    if (!this._table) {
      throw new QueryError('Table not specified: call .from() before .build()');
    }
    return {
      type:    'SELECT',
      table:   this._table,
      columns: this._columns.length ? [...this._columns] : ['*'],
      where:   this._filters.length  ? [...this._filters]  : undefined,
      orderBy: this._orderBys.length ? [...this._orderBys] : undefined,
      limit:   this._limit,
      offset:  this._offset,
      joins:   this._joins.length    ? [...this._joins]    : undefined,
    };
  }

  toSQL(dialect: DialectName): RenderedQuery {
    return new SqlRenderer(dialect).render(this.build());
  }

  static insert(table: string, values: Record<string, unknown>[]): InsertQuery {
    return { type: 'INSERT', table, values };
  }

  static update(
    table:  string,
    set:    Record<string, unknown>,
    where?: Filter[],
  ): UpdateQuery {
    return { type: 'UPDATE', table, set, where };
  }

  static deleteFrom(table: string, where?: Filter[]): DeleteQuery {
    return { type: 'DELETE', table, where };
  }

  static raw(sql: string, params?: unknown[]): RawQuery {
    return { type: 'RAW', sql, params };
  }
}
