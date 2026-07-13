/**
 * PROMETHEUS adapter — converts a @seltriva/database-sdk DatabaseSchema into
 * the DatabaseInput format expected by @seltriva/database-intelligence DatabaseScanner.
 *
 * All fields that database-sdk does not provide are filled with safe defaults
 * (null / false / empty) so the ATHENA classifiers can still operate on the
 * name and column signals they do have.
 */
import type { DatabaseSchema, Table, Column } from '@seltriva/database-sdk';
import type {
  DatabaseInput,
  SchemaInput,
  TableInput,
  ColumnInput,
  PrimaryKeyInput,
  ForeignKeyInput,
  IndexInput,
} from '@seltriva/database-intelligence';

export interface AdaptOptions {
  /** Originating host — stored in the report but not used for classification. */
  host?: string;
  /** Originating port — stored in the report but not used for classification. */
  port?: number;
  /** Database name — defaults to DatabaseSchema.name. */
  database?: string;
  /** Schema name — defaults to 'public'. */
  schema?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function adaptDatabaseSchema(ds: DatabaseSchema, opts: AdaptOptions = {}): DatabaseInput {
  const schemaName = opts.schema ?? 'public';
  const tables: TableInput[] = ds.tables.map((t) => adaptTable(t, schemaName));

  return {
    host: opts.host ?? 'localhost',
    port: opts.port ?? 5432,
    database: opts.database ?? ds.name,
    schemas: [{ name: schemaName, tables }],
    extensions: [],
  };
}

// ─── Table ────────────────────────────────────────────────────────────────────

function adaptTable(t: Table, schema: string): TableInput {
  return {
    schema,
    name: t.name,
    comment: null,
    isPartitioned: false,
    columns: t.columns.map(adaptColumn),
    primaryKey: buildPrimaryKey(t),
    foreignKeys: t.foreignKeys.map((fk, i) => adaptForeignKey(fk, t.name, schema, i)),
    indexes: t.indexes.map(adaptIndex),
  };
}

function buildPrimaryKey(t: Table): PrimaryKeyInput | null {
  // Prefer the explicit PrimaryKey object if present
  if (t.primaryKey && t.primaryKey.columns.length > 0) {
    return { constraintName: `pk_${t.name}`, columns: t.primaryKey.columns };
  }
  // Fall back to columns marked isPrimaryKey
  const pkCols = t.columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
  if (pkCols.length > 0) {
    return { constraintName: `pk_${t.name}`, columns: pkCols };
  }
  return null;
}

function adaptForeignKey(
  fk: Table['foreignKeys'][number],
  tableName: string,
  schema: string,
  index: number
): ForeignKeyInput {
  return {
    constraintName: `fk_${tableName}_${index}`,
    columns: [fk.column],
    referencedSchema: schema,
    referencedTable: fk.referencedTable,
    referencedColumns: [fk.referencedColumn],
    deleteRule: 'NO ACTION',
    updateRule: 'NO ACTION',
  };
}

function adaptIndex(idx: Table['indexes'][number]): IndexInput {
  return {
    name: idx.name,
    columns: idx.columns,
    isUnique: idx.isUnique,
    isPrimary: idx.isPrimary,
    indexType: 'btree',
  };
}

// ─── Column ───────────────────────────────────────────────────────────────────

const IDENTITY_TYPES = new Set(['serial', 'bigserial', 'smallserial']);

function adaptColumn(c: Column): ColumnInput {
  return {
    name: c.name,
    dataType: c.type,
    isNullable: c.nullable,
    columnDefault: c.defaultValue != null ? String(c.defaultValue) : null,
    numericPrecision: c.precision ?? null,
    numericScale: c.scale ?? null,
    maxLength: c.maxLength ?? null,
    userDefinedType: null,
    comment: null,
    isIdentity: c.isPrimaryKey && IDENTITY_TYPES.has(c.type.toLowerCase()),
  };
}
