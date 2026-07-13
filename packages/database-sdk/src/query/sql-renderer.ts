import type { Query, SelectQuery, InsertQuery, UpdateQuery, DeleteQuery } from './query-types.js';
import type { Filter, SimpleFilter, CompoundFilter } from '../filters/expressions.js';
import { QueryError } from '../errors/database-errors.js';

export type DialectName = 'postgres' | 'mysql' | 'sqlserver' | 'oracle' | 'firebird';

export interface RenderedQuery {
  readonly sql: string;
  readonly params: unknown[];
}

export class SqlRenderer {
  constructor(private readonly _dialect: DialectName) {}

  render(query: Query): RenderedQuery {
    const params: unknown[] = [];
    let sql: string;

    switch (query.type) {
      case 'SELECT':
        sql = this._renderSelect(query, params);
        break;
      case 'INSERT':
        sql = this._renderInsert(query, params);
        break;
      case 'UPDATE':
        sql = this._renderUpdate(query, params);
        break;
      case 'DELETE':
        sql = this._renderDelete(query, params);
        break;
      case 'RAW':
        sql = query.sql;
        if (query.params) params.push(...query.params);
        break;
      default: {
        const _: never = query;
        throw new QueryError(`Unknown query type: ${JSON.stringify(_)}`);
      }
    }

    return { sql, params };
  }

  private _renderSelect(q: SelectQuery, params: unknown[]): string {
    const cols = q.columns.length
      ? q.columns.map((c) => (c === '*' ? '*' : this._id(c))).join(', ')
      : '*';

    let sql = `SELECT ${cols} FROM ${this._id(q.table)}`;

    if (q.joins?.length) {
      sql += ' ' + q.joins.map((j) => `${j.type} JOIN ${this._id(j.table)} ON ${j.on}`).join(' ');
    }

    if (q.where?.length) {
      sql += ' WHERE ' + q.where.map((f) => this._renderFilter(f, params)).join(' AND ');
    }

    if (q.orderBy?.length) {
      sql += ' ORDER BY ' + q.orderBy.map((o) => `${this._id(o.column)} ${o.direction}`).join(', ');
    }

    sql = this._paginate(sql, q.limit, q.offset);
    return sql;
  }

  private _paginate(sql: string, limit?: number, offset?: number): string {
    switch (this._dialect) {
      case 'sqlserver':
        if (limit !== undefined) {
          sql += ` OFFSET ${offset ?? 0} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        } else if (offset !== undefined) {
          sql += ` OFFSET ${offset} ROWS`;
        }
        break;
      case 'oracle':
        if (limit !== undefined && offset !== undefined) {
          sql += ` OFFSET ${offset} ROWS FETCH FIRST ${limit} ROWS ONLY`;
        } else if (limit !== undefined) {
          sql += ` FETCH FIRST ${limit} ROWS ONLY`;
        } else if (offset !== undefined) {
          sql += ` OFFSET ${offset} ROWS`;
        }
        break;
      case 'firebird': {
        const first = limit !== undefined ? `FIRST ${limit} ` : '';
        const skip = offset !== undefined ? `SKIP ${offset} ` : '';
        if (first || skip) {
          sql = sql.replace(/^SELECT /, `SELECT ${first}${skip}`);
        }
        break;
      }
      default: // postgres, mysql
        if (limit !== undefined) sql += ` LIMIT ${limit}`;
        if (offset !== undefined) sql += ` OFFSET ${offset}`;
    }
    return sql;
  }

  private _renderFilter(f: Filter, params: unknown[]): string {
    // Compound operators — no field, recurse into sub-filters
    if (f.operator === 'and' || f.operator === 'or') {
      const sep = f.operator === 'and' ? ' AND ' : ' OR ';
      const sub = (f as CompoundFilter).filters.map((sf) => this._renderFilter(sf, params));
      return `(${sub.join(sep)})`;
    }

    // TypeScript narrows f to SimpleFilter here
    const sf = f as SimpleFilter;
    const col = this._id(sf.field);

    switch (sf.operator) {
      case 'eq':
        return `${col} = ${this._p(params, sf.value)}`;
      case 'neq':
        return `${col} != ${this._p(params, sf.value)}`;
      case 'gt':
        return `${col} > ${this._p(params, sf.value)}`;
      case 'gte':
        return `${col} >= ${this._p(params, sf.value)}`;
      case 'lt':
        return `${col} < ${this._p(params, sf.value)}`;
      case 'lte':
        return `${col} <= ${this._p(params, sf.value)}`;
      case 'like':
        return `${col} LIKE ${this._p(params, sf.value)}`;
      case 'isNull':
        return `${col} IS NULL`;
      case 'isNotNull':
        return `${col} IS NOT NULL`;
      case 'in': {
        const vals = Array.isArray(sf.value) ? sf.value : [sf.value];
        return `${col} IN (${vals.map((v) => this._p(params, v)).join(', ')})`;
      }
      case 'between': {
        const arr = Array.isArray(sf.value) ? sf.value : [sf.value, sf.value];
        return `${col} BETWEEN ${this._p(params, arr[0])} AND ${this._p(params, arr[1])}`;
      }
      default: {
        const _: never = sf.operator;
        throw new QueryError(`Unknown filter operator: ${String(_)}`);
      }
    }
  }

  private _renderInsert(q: InsertQuery, params: unknown[]): string {
    if (!q.values.length) throw new QueryError('INSERT requires at least one row');
    const first = q.values[0]!;
    const cols = Object.keys(first)
      .map((c) => this._id(c))
      .join(', ');
    const rowSets = q.values
      .map(
        (row) =>
          `(${Object.values(row)
            .map((v) => this._p(params, v))
            .join(', ')})`
      )
      .join(', ');
    let sql = `INSERT INTO ${this._id(q.table)} (${cols}) VALUES ${rowSets}`;
    if (q.returning?.length) sql += ` RETURNING ${q.returning.map((c) => this._id(c)).join(', ')}`;
    return sql;
  }

  private _renderUpdate(q: UpdateQuery, params: unknown[]): string {
    const sets = Object.entries(q.set)
      .map(([k, v]) => `${this._id(k)} = ${this._p(params, v)}`)
      .join(', ');
    let sql = `UPDATE ${this._id(q.table)} SET ${sets}`;
    if (q.where?.length)
      sql += ' WHERE ' + q.where.map((f) => this._renderFilter(f, params)).join(' AND ');
    if (q.returning?.length) sql += ` RETURNING ${q.returning.map((c) => this._id(c)).join(', ')}`;
    return sql;
  }

  private _renderDelete(q: DeleteQuery, params: unknown[]): string {
    let sql = `DELETE FROM ${this._id(q.table)}`;
    if (q.where?.length)
      sql += ' WHERE ' + q.where.map((f) => this._renderFilter(f, params)).join(' AND ');
    if (q.returning?.length) sql += ` RETURNING ${q.returning.map((c) => this._id(c)).join(', ')}`;
    return sql;
  }

  private _id(name: string): string {
    switch (this._dialect) {
      case 'mysql':
        return `\`${name}\``;
      case 'sqlserver':
        return `[${name}]`;
      default:
        return `"${name}"`;
    }
  }

  private _p(params: unknown[], value: unknown): string {
    params.push(value);
    const i = params.length;
    switch (this._dialect) {
      case 'postgres':
        return `$${i}`;
      case 'sqlserver':
        return `@p${i}`;
      case 'oracle':
        return `:${i}`;
      default:
        return '?'; // mysql, firebird
    }
  }
}
